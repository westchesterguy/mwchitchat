"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { contact } from "@/lib/sites";
import { Mark } from "./Mark";

type FieldType = "text" | "email" | "tel" | "textarea" | "select" | "checkbox";
interface Field {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
}
interface Config {
  online: boolean;
  phone: string;
  phoneHref: string;
  fields: Field[];
}
interface Message {
  id: number;
  sender: "visitor" | "agent" | "system";
  body: string;
  at: string;
}
interface Conversation {
  id: string;
  status: "open" | "closed";
}
interface Page {
  url: string | null;
  title: string | null;
  referrer: string | null;
}

/** Messages to the page around the frame (widget.js). Nothing sensitive. */
function tellParent(type: string) {
  if (window.parent !== window) window.parent.postMessage({ type }, "*");
}

/** The token widget.js passes in the URL fragment, which never reaches a server. */
function readToken(): string {
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("t");
  if (fromHash && /^[A-Za-z0-9_-]{32,128}$/.test(fromHash)) return fromHash;
  // Opened directly rather than through widget.js: keep a token for this tab.
  try {
    const kept = sessionStorage.getItem("mwchat:token");
    if (kept) return kept;
  } catch {}
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  try {
    sessionStorage.setItem("mwchat:token", token);
  } catch {}
  return token;
}

const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export function ChatWindow({ site, privacyUrl }: { site: string; privacyUrl: string }) {
  const [phase, setPhase] = useState<"loading" | "form" | "chat" | "error">("loading");
  const [config, setConfig] = useState<Config | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inFrame, setInFrame] = useState(false);

  const token = useRef("");
  const page = useRef<Page>({ url: null, title: null, referrer: null });
  const visible = useRef(true);
  const lastId = useRef(0);

  const api = useCallback(async (path: string, body?: unknown) => {
    const res = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", "x-mwchat-token": token.current },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }, []);

  const merge = useCallback((incoming: Message[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
    lastId.current = Math.max(lastId.current, ...incoming.map((m) => m.id));
  }, []);

  // First load: questions, and any chat already under way.
  useEffect(() => {
    setInFrame(window.parent !== window);
    visible.current = window.parent === window;
    token.current = readToken();
    page.current.url = window.parent === window ? window.location.href : null;

    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; url?: string; title?: string; referrer?: string; open?: boolean };
      if (d?.type === "mwchat:page") {
        page.current = { url: d.url ?? null, title: d.title ?? null, referrer: d.referrer || null };
      } else if (d?.type === "mwchat:visible") {
        visible.current = Boolean(d.open);
      }
    };
    window.addEventListener("message", onMessage);
    tellParent("mwchat:ready");

    (async () => {
      try {
        const [c, s] = await Promise.all([
          api(`/api/v/config?site=${encodeURIComponent(site)}`),
          api(`/api/v/state`),
        ]);
        if (!c.ok) throw new Error("config");
        setConfig(c.data);
        if (s.ok && s.data.conversation) {
          setConversation(s.data.conversation);
          merge(s.data.messages);
          setPhase("chat");
        } else {
          setPhase("form");
        }
      } catch {
        setPhase("error");
      }
    })();

    return () => window.removeEventListener("message", onMessage);
  }, [api, merge, site]);

  // While a chat exists: poll for replies. Faster while the window is open.
  useEffect(() => {
    if (!conversation) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const { ok, data } = await api(`/api/v/state?after=${lastId.current}`);
        if (ok && data.conversation) {
          const incoming = data.messages as Message[];
          if (!visible.current && incoming.some((m) => m.sender === "agent" && m.id > lastId.current)) {
            tellParent("mwchat:unread");
          }
          merge(incoming);
          setConversation((c) => (c && c.status !== data.conversation.status ? data.conversation : c));
          setConfig((c) => (c && c.online !== data.online ? { ...c, online: data.online } : c));
          if (data.conversation.status === "closed") tellParent("mwchat:ended");
        }
      } catch {}
      if (!stopped) timer = setTimeout(tick, visible.current ? 2500 : 8000);
    };
    timer = setTimeout(tick, 2500);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [conversation, api, merge]);

  const start = async (answers: Record<string, string | boolean>, message: string) => {
    const { ok, data } = await api("/api/v/start", { site, page: page.current, answers, message });
    if (!ok) return data as { field?: string; message?: string; error?: string };
    setConversation(data.conversation);
    setMessages([]);
    lastId.current = 0;
    merge(data.messages);
    setConfig((c) => (c ? { ...c, online: data.online } : c));
    setPhase("chat");
    tellParent("mwchat:started");
    return null;
  };

  const send = async (text: string) => {
    const { ok, status, data } = await api("/api/v/message", { body: text });
    if (ok) merge([data.message]);
    else if (status === 409) setConversation((c) => (c ? { ...c, status: "closed" } : c));
    return ok;
  };

  const end = async () => {
    await api("/api/v/end", {});
    setConversation((c) => (c ? { ...c, status: "closed" } : c));
    const { data } = await api(`/api/v/state?after=${lastId.current}`);
    if (data?.messages) merge(data.messages);
    tellParent("mwchat:ended");
  };

  // The questions may have changed since this window loaded.
  const newChat = async () => {
    const { ok, data } = await api(`/api/v/config?site=${encodeURIComponent(site)}`);
    if (ok) setConfig(data);
    setPhase("form");
  };

  const open = conversation?.status === "open";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white text-ink">
      <header className="on-navy flex items-center gap-3 bg-navy px-4 py-3 text-white">
        <Mark className="w-7" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[17px] leading-tight">Michael Winter</p>
          {config && (
            <p className="flex items-center gap-1.5 text-[12px] text-white/75">
              <span
                aria-hidden
                className={`inline-block h-2 w-2 rounded-full ${config.online ? "bg-[#4cc28a]" : "bg-white/40"}`}
              />
              {config.online ? "Online now" : "Away, will follow up by email"}
            </p>
          )}
        </div>
        {phase === "chat" && open && (
          <button
            type="button"
            onClick={end}
            className="rounded-sm px-2 py-1 text-[12px] uppercase tracking-[0.08em] text-white/80 hover:text-white"
          >
            End chat
          </button>
        )}
        {inFrame && (
          <button
            type="button"
            onClick={() => tellParent("mwchat:close")}
            aria-label="Close chat"
            className="-mr-1 rounded-sm p-1.5 text-white/80 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </header>

      {phase === "loading" && <p className="m-auto text-sm text-muted">Loading…</p>}

      {phase === "error" && config === null && (
        <div className="m-auto max-w-[280px] text-center text-sm text-ink-soft">
          <p>The chat isn&rsquo;t available right now.</p>
          <p className="mt-2">
            You can reach Michael at{" "}
            <a className="underline" href={`tel:${contact.phone}`}>
              {contact.phoneDisplay}
            </a>
            .
          </p>
        </div>
      )}

      {phase === "form" && config && (
        <PrechatForm config={config} privacyUrl={privacyUrl} onSubmit={start} />
      )}

      {phase === "chat" && config && (
        <>
          <MessageList messages={messages} />
          {open ? (
            <Composer onSend={send} />
          ) : (
            <div className="border-t border-line px-4 py-4 text-center">
              <p className="text-sm text-ink-soft">This chat has ended.</p>
              <button
                type="button"
                onClick={newChat}
                className="mt-3 inline-flex items-center rounded-sm bg-navy px-5 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] text-white hover:bg-navy-light"
              >
                Start a new chat
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MessageList({ messages }: { messages: Message[] }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div role="log" aria-live="polite" className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
      {messages.map((m, i) => {
        if (m.sender === "system") {
          return (
            <p key={m.id} className="px-6 py-1 text-center text-[12px] leading-snug text-muted">
              {m.body}
            </p>
          );
        }
        const mine = m.sender === "visitor";
        const firstOfRun = messages[i - 1]?.sender !== m.sender;
        return (
          <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
            {!mine && firstOfRun && <span className="mb-1 ml-1 text-[11px] text-muted">Michael</span>}
            <div
              className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3.5 py-2 text-[14px] leading-relaxed ${
                mine ? "rounded-br-sm bg-navy text-white" : "rounded-bl-sm bg-bubble text-ink"
              }`}
            >
              {m.body}
            </div>
            <span className="mx-1 mt-0.5 text-[10px] text-muted">{time.format(new Date(m.at))}</span>
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}

function Composer({ onSend }: { onSend: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setFailed(false);
    const ok = await onSend(value);
    setSending(false);
    if (ok) setText("");
    else setFailed(true);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="border-t border-line px-3 py-3"
    >
      {failed && <p className="mb-2 text-[12px] text-danger">That didn&rsquo;t send. Please try again.</p>}
      <div className="flex items-end gap-2">
        <label htmlFor="mwchat-input" className="sr-only">
          Message
        </label>
        <textarea
          id="mwchat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Write a message"
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-sm border border-line bg-paper px-3 py-2.5 text-[14px] outline-none focus:border-navy"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          aria-label="Send"
          className="flex h-[42px] w-[42px] items-center justify-center rounded-sm bg-navy text-white disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
            <path d="M4 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </form>
  );
}

function PrechatForm({
  config,
  privacyUrl,
  onSubmit,
}: {
  config: Config;
  privacyUrl: string;
  onSubmit: (
    answers: Record<string, string | boolean>,
    message: string,
  ) => Promise<{ field?: string; message?: string; error?: string } | null>;
}) {
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const set = (key: string, value: string | boolean) => setAnswers((a) => ({ ...a, [key]: value }));
  const input =
    "w-full rounded-sm border border-line bg-paper px-3 py-2.5 text-[14px] outline-none focus:border-navy";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFailed(false);
    setErrors({});
    const problem = await onSubmit(answers, message);
    setBusy(false);
    if (problem?.field) setErrors({ [problem.field]: problem.message ?? "Please check this field." });
    else if (problem) setFailed(true);
  };

  return (
    <form onSubmit={submit} className="flex-1 overflow-y-auto px-4 py-4">
      <p className="text-[14px] leading-relaxed text-ink-soft">
        {config.online
          ? "Michael is online. Tell him a little about yourself to start a chat."
          : "Michael is away right now. Leave your details and a message, and he will follow up."}
      </p>

      <div className="mt-4 space-y-3.5">
        {config.fields.map((f) => {
          const id = `f-${f.key}`;
          const error = errors[f.key];
          if (f.type === "checkbox") {
            return (
              <div key={f.key}>
                <div className="flex items-start gap-2.5">
                  <input
                    id={id}
                    type="checkbox"
                    checked={answers[f.key] === true}
                    onChange={(e) => set(f.key, e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-navy"
                  />
                  <label htmlFor={id} className="text-[12px] leading-relaxed text-ink-soft">
                    {f.label}
                    {f.required && <span className="text-danger"> *</span>}
                  </label>
                </div>
                {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
              </div>
            );
          }
          return (
            <div key={f.key}>
              <label htmlFor={id} className="mb-1 block text-[12px] font-medium text-ink-soft">
                {f.label}
                {f.required && <span className="text-danger"> *</span>}
              </label>
              {f.type === "select" ? (
                <select
                  id={id}
                  required={f.required}
                  value={(answers[f.key] as string) ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  className={input}
                >
                  <option value="">Choose one</option>
                  {f.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  id={id}
                  required={f.required}
                  rows={3}
                  maxLength={2000}
                  value={(answers[f.key] as string) ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  className={input}
                />
              ) : (
                <input
                  id={id}
                  type={f.type}
                  required={f.required}
                  maxLength={200}
                  autoComplete={f.type === "email" ? "email" : f.type === "tel" ? "tel" : f.key === "name" ? "name" : undefined}
                  value={(answers[f.key] as string) ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  className={input}
                />
              )}
              {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
            </div>
          );
        })}

        <div>
          <label htmlFor="f-message" className="mb-1 block text-[12px] font-medium text-ink-soft">
            Your message<span className="text-danger"> *</span>
          </label>
          <textarea
            id="f-message"
            required
            rows={3}
            maxLength={2000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={input}
          />
          {errors.message && <p className="mt-1 text-[12px] text-danger">{errors.message}</p>}
        </div>
      </div>

      {failed && (
        <p className="mt-3 text-[12px] text-danger">
          Something went wrong. Please try again, or call Michael at{" "}
          <a className="underline" href={config.phoneHref}>
            {config.phone}
          </a>
          .
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 w-full rounded-sm bg-navy px-5 py-3 text-[13px] font-medium uppercase tracking-[0.08em] text-white hover:bg-navy-light disabled:opacity-50"
      >
        {busy ? "Starting…" : config.online ? "Start chat" : "Send message"}
      </button>

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Chats are saved with your approximate location and IP address so Michael can follow up.{" "}
        <a href={privacyUrl} target="_blank" rel="noopener noreferrer" className="underline">
          Privacy Policy
        </a>
        . Prefer to call?{" "}
        <a href={config.phoneHref} className="underline">
          {config.phone}
        </a>
      </p>
    </form>
  );
}
