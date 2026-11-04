"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { contact, HEADSHOT_URL } from "@/lib/sites";
import { Composer } from "./chat/Composer";
import { Thread } from "./chat/Thread";
import { useMessages, type ChatMessage } from "./chat/useMessages";
import { Avatar } from "./ui/Avatar";
import { ChatIcon, ChevronDownIcon, PhoneIcon, SendIcon, Spinner } from "./ui/icons";
import { Menu, type MenuItem } from "./ui/Menu";

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
interface Conversation {
  id: string;
  status: "open" | "closed";
}
interface Page {
  url: string | null;
  title: string | null;
  referrer: string | null;
}

const MICHAEL = "Michael Winter";

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

/**
 * The visitor's chat window, shown in a frame on the sites by widget.js:
 * Michael's greeting and the pre-chat questions, then live messages.
 */
export function ChatWindow({ site, privacyUrl }: { site: string; privacyUrl: string }) {
  const [phase, setPhase] = useState<"loading" | "form" | "chat" | "error">("loading");
  const [config, setConfig] = useState<Config | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [inFrame, setInFrame] = useState(false);
  const { messages, lastId, merge, reset, optimistic, settle, remove } = useMessages();

  const token = useRef("");
  const page = useRef<Page>({ url: null, title: null, referrer: null });
  const visible = useRef(true);

  const api = useCallback(async (path: string, body?: unknown) => {
    try {
      const res = await fetch(path, {
        method: body === undefined ? "GET" : "POST",
        headers: { "content-type": "application/json", "x-mwchat-token": token.current },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch {
      return { ok: false, status: 0, data: {} as Record<string, never> };
    }
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
      const [c, s] = await Promise.all([api(`/api/v/config?site=${encodeURIComponent(site)}`), api(`/api/v/state`)]);
      if (!c.ok) {
        setPhase("error");
        return;
      }
      setConfig(c.data);
      if (s.ok && s.data.conversation) {
        setConversation(s.data.conversation);
        merge(s.data.messages);
        setPhase("chat");
      } else {
        setPhase("form");
      }
    })();

    return () => window.removeEventListener("message", onMessage);
  }, [api, merge, site]);

  // While a chat exists: poll for replies, faster while the window is open.
  useEffect(() => {
    if (!conversation) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const { ok, data } = await api(`/api/v/state?after=${lastId.current}`);
      if (ok && data.conversation) {
        const incoming = data.messages as ChatMessage[];
        if (!visible.current && incoming.some((m) => m.sender === "agent" && m.id > lastId.current)) {
          tellParent("mwchat:unread");
        }
        merge(incoming);
        setConversation((c) => (c && c.status !== data.conversation.status ? data.conversation : c));
        setConfig((c) => (c && c.online !== data.online ? { ...c, online: data.online } : c));
        if (data.conversation.status === "closed") tellParent("mwchat:ended");
      }
      if (!stopped) timer = setTimeout(tick, visible.current ? 2500 : 8000);
    };
    timer = setTimeout(tick, 2500);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [conversation, api, merge, lastId]);

  const start = async (answers: Record<string, string | boolean>, message: string) => {
    const { ok, data } = await api("/api/v/start", { site, page: page.current, answers, message });
    if (!ok) return data as { field?: string; message?: string; error?: string };
    reset();
    merge(data.messages);
    setConversation(data.conversation);
    setConfig((c) => (c ? { ...c, online: data.online } : c));
    setPhase("chat");
    tellParent("mwchat:started");
    return null;
  };

  const send = async (text: string) => {
    const temp = optimistic("visitor", text);
    const { ok, status, data } = await api("/api/v/message", { body: text });
    settle(temp, ok ? data.message : null);
    if (status === 409) setConversation((c) => (c ? { ...c, status: "closed" } : c));
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
  const online = config?.online ?? true;
  const menu: MenuItem[] = [
    { label: `Call ${contact.phoneDisplay}`, icon: <PhoneIcon className="h-[18px] w-[18px]" />, href: `tel:${contact.phone}` },
    ...(phase === "chat" && open
      ? [{ label: "End chat", icon: <ChatIcon className="h-[18px] w-[18px]" />, onSelect: end, danger: true }]
      : []),
  ];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas text-ink">
      <header className="on-navy flex items-center gap-3 bg-navy py-3 pl-4 pr-2 text-white">
        <Avatar name={MICHAEL} src={HEADSHOT_URL} online={online} ring="#002349" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold leading-tight">{MICHAEL}</p>
          <p className="mt-0.5 truncate text-[12px] text-white/70">
            {config ? (online ? "Online now" : "Away, will follow up") : "The Westchester Guy"}
          </p>
        </div>
        <Menu items={menu} buttonClass="text-white/90 hover:bg-white/10" />
        {inFrame && (
          <button
            type="button"
            onClick={() => tellParent("mwchat:close")}
            aria-label="Minimize chat"
            className="press rounded-full p-2 text-white/90 hover:bg-white/10"
          >
            <ChevronDownIcon className="h-6 w-6" />
          </button>
        )}
      </header>

      {phase === "loading" && (
        <div className="flex-1 space-y-3 px-4 py-6" aria-label="Loading" role="status">
          <span className="skeleton block h-16 w-4/5 !rounded-2xl" />
          <span className="skeleton block h-64 w-full !rounded-2xl" />
        </div>
      )}

      {phase === "error" && (
        <div className="anim-fade m-auto max-w-[300px] px-6 text-center">
          <p className="text-[15px] font-medium">The chat isn&rsquo;t available right now.</p>
          <a
            href={`tel:${contact.phone}`}
            className="press mt-4 inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-[14px] font-medium text-white"
          >
            <PhoneIcon className="h-4 w-4" /> Call {contact.phoneDisplay}
          </a>
        </div>
      )}

      {phase === "form" && config && (
        <PrechatForm config={config} privacyUrl={privacyUrl} onSubmit={start} />
      )}

      {phase === "chat" && (
        <>
          <Thread
            messages={messages}
            mine="visitor"
            otherName="Michael"
            otherAvatar={<Avatar name={MICHAEL} src={HEADSHOT_URL} size="sm" />}
            onRetry={(m) => {
              remove(m.id);
              send(m.body);
            }}
          />
          {open ? (
            <Composer onSend={send} placeholder="Message" autoFocus />
          ) : (
            <div className="anim-rise border-t border-line bg-paper px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 text-center">
              <p className="text-[14px] text-muted">This chat has ended.</p>
              <button
                type="button"
                onClick={newChat}
                className="press mt-3 inline-flex h-11 items-center gap-2 rounded-full bg-navy px-6 text-[14px] font-semibold text-white shadow-[0_2px_8px_rgba(0,35,73,0.3)]"
              >
                <ChatIcon className="h-[18px] w-[18px]" /> Start a new chat
              </button>
            </div>
          )}
        </>
      )}
    </div>
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
    "w-full rounded-xl border bg-surface px-3.5 text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-navy/50 focus:shadow-[0_0_0_3px_rgba(0,35,73,0.08)]";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFailed(false);
    setErrors({});
    const problem = await onSubmit(answers, message);
    setBusy(false);
    if (problem?.field) setErrors({ [problem.field]: problem.message ?? "Please check this." });
    else if (problem) setFailed(true);
  };

  const greeting = config.online
    ? "Hello, and thanks for visiting. Tell me a little about yourself and I'll reply here."
    : "Thanks for visiting. I'm away right now. Leave your details and a message, and I'll follow up.";

  return (
    <form onSubmit={submit} className="scroll-thin flex-1 overflow-y-auto px-3 pb-6 pt-4 sm:px-4">
      <div className="anim-rise flex items-end gap-2">
        <Avatar name={MICHAEL} src={HEADSHOT_URL} size="sm" />
        <div className="flex max-w-[85%] flex-col items-start">
          <span className="mb-1 ml-3 text-[11px] font-medium text-muted">Michael</span>
          <p className="rounded-[18px] rounded-bl-[6px] bg-bubble px-3.5 py-2.5 text-[15px] leading-[1.4] shadow-[var(--shadow-bubble)]">
            {greeting}
          </p>
        </div>
      </div>

      <div className="anim-rise mt-4 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)]" style={{ animationDelay: "60ms" }}>
        <div className="space-y-3.5">
          {config.fields.map((f) => {
            const id = `f-${f.key}`;
            const error = errors[f.key];
            const border = error ? "border-danger/60" : "border-line";
            if (f.type === "checkbox") {
              return (
                <div key={f.key}>
                  <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
                    <input
                      id={id}
                      type="checkbox"
                      checked={answers[f.key] === true}
                      onChange={(e) => set(f.key, e.target.checked)}
                      className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer rounded accent-navy"
                    />
                    <span className="text-[12px] leading-relaxed text-muted">
                      {f.label}
                      {f.required && <span className="text-danger"> *</span>}
                    </span>
                  </label>
                  {error && <p className="anim-fade mt-1 text-[12px] text-danger">{error}</p>}
                </div>
              );
            }
            return (
              <div key={f.key}>
                <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-soft">
                  {f.label}
                  {f.required && <span className="text-danger"> *</span>}
                </label>
                {f.type === "select" ? (
                  <span className="relative block">
                    <select
                      id={id}
                      required={f.required}
                      value={(answers[f.key] as string) ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                      className={`${input} ${border} h-11 appearance-none pr-10 ${answers[f.key] ? "" : "text-faint"}`}
                    >
                      <option value="">Choose one</option>
                      {f.options.map((o) => (
                        <option key={o} className="text-ink">
                          {o}
                        </option>
                      ))}
                    </select>
                    <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-faint" />
                  </span>
                ) : f.type === "textarea" ? (
                  <textarea
                    id={id}
                    required={f.required}
                    rows={3}
                    maxLength={2000}
                    value={(answers[f.key] as string) ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    className={`${input} ${border} py-2.5`}
                  />
                ) : (
                  <input
                    id={id}
                    type={f.type}
                    required={f.required}
                    maxLength={200}
                    autoComplete={f.type === "email" ? "email" : f.type === "tel" ? "tel" : f.key === "name" ? "name" : undefined}
                    inputMode={f.type === "tel" ? "tel" : f.type === "email" ? "email" : undefined}
                    value={(answers[f.key] as string) ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    className={`${input} ${border} h-11`}
                  />
                )}
                {error && <p className="anim-fade mt-1 text-[12px] text-danger">{error}</p>}
              </div>
            );
          })}

          <div>
            <label htmlFor="f-message" className="mb-1.5 block text-[13px] font-medium text-ink-soft">
              Your message<span className="text-danger"> *</span>
            </label>
            <textarea
              id="f-message"
              required
              rows={3}
              maxLength={2000}
              value={message}
              placeholder="How can I help?"
              onChange={(e) => setMessage(e.target.value)}
              className={`${input} ${errors.message ? "border-danger/60" : "border-line"} resize-none py-2.5`}
            />
            {errors.message && <p className="anim-fade mt-1 text-[12px] text-danger">{errors.message}</p>}
          </div>
        </div>

        {failed && (
          <p className="anim-fade mt-3 text-[13px] text-danger">
            That didn&rsquo;t go through. Please try again, or call{" "}
            <a className="underline" href={config.phoneHref}>
              {config.phone}
            </a>
            .
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="press mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-navy text-[15px] font-semibold text-white shadow-[0_2px_10px_rgba(0,35,73,0.3)] hover:bg-navy-light disabled:opacity-70"
        >
          {busy ? <Spinner /> : <SendIcon className="h-[18px] w-[18px]" strokeWidth={2} />}
          {busy ? "Starting" : config.online ? "Start chat" : "Send message"}
        </button>
      </div>

      <p className="mt-3 px-2 text-center text-[11px] leading-relaxed text-faint">
        Chats are saved with your approximate location and IP address so Michael can follow up.{" "}
        <a href={privacyUrl} target="_blank" rel="noopener noreferrer" className="underline">
          Privacy Policy
        </a>
      </p>
    </form>
  );
}
