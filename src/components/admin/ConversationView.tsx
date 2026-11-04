"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi, ago, clock, device, pagePath, place, poll, siteName } from "./util";

interface Message {
  id: number;
  sender: "visitor" | "agent" | "system";
  body: string;
  at: string;
}
interface Conversation {
  id: string;
  site: string;
  status: "open" | "closed";
  start_url: string | null;
  start_title: string | null;
  prechat: { key: string; label: string; value: string }[];
  ip: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  created_at: string;
}
interface Visitor {
  name: string | null;
  email: string | null;
  phone: string | null;
  first_site: string;
  created_at: string;
  last_seen_at: string;
  online: boolean;
  current_site: string | null;
  current_url: string | null;
  current_title: string | null;
  referrer: string | null;
  ip: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  user_agent: string | null;
  chats: number;
}

export function ConversationView({ id }: { id: string }) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [missing, setMissing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const lastId = useRef(0);

  const merge = useCallback((incoming: Message[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
    lastId.current = Math.max(lastId.current, ...incoming.map((m) => m.id));
  }, []);

  useEffect(
    () =>
      poll(async () => {
        const { ok, status, data } = await adminApi<{
          conversation: Conversation;
          visitor: Visitor;
          messages: Message[];
        }>(`/api/admin/conversations/${id}?after=${lastId.current}`);
        if (status === 404) setMissing(true);
        if (!ok) return;
        setConversation(data.conversation);
        setVisitor(data.visitor);
        merge(data.messages);
      }, 2500),
    [id, merge],
  );

  const send = async (text: string) => {
    const { ok, data } = await adminApi<{ message: Message }>(`/api/admin/conversations/${id}/messages`, "POST", {
      body: text,
    });
    if (ok) {
      merge([data.message]);
      setConversation((c) => (c ? { ...c, status: "open" } : c));
    }
    return ok;
  };

  const setStatus = async (status: "open" | "closed") => {
    const { ok } = await adminApi(`/api/admin/conversations/${id}/status`, "POST", { status });
    if (ok) setConversation((c) => (c ? { ...c, status } : c));
  };

  if (missing) {
    return (
      <p className="px-4 py-10 text-center text-[14px] text-muted">
        This chat no longer exists. <Link href="/admin" className="underline">Back to chats</Link>
      </p>
    );
  }
  if (!conversation || !visitor) return <p className="px-4 py-10 text-center text-[14px] text-muted">Loading…</p>;

  return (
    <div className="flex min-h-0 flex-1">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
        <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
          <Link href="/admin" aria-label="Back to chats" className="-ml-1 p-1 text-ink-soft">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium">{visitor.name || visitor.email || "Visitor"}</p>
            <p className="truncate text-[11px] text-muted">
              {visitor.online ? (
                <span className="text-ok">Online now</span>
              ) : (
                `Last seen ${ago(visitor.last_seen_at)}`
              )}{" "}
              · started on {siteName(conversation.site)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDetails((s) => !s)}
            className="rounded-sm border border-line px-2.5 py-1.5 text-[12px] text-ink-soft lg:hidden"
          >
            {showDetails ? "Chat" : "Details"}
          </button>
          <button
            type="button"
            onClick={() => setStatus(conversation.status === "open" ? "closed" : "open")}
            className="rounded-sm border border-line px-2.5 py-1.5 text-[12px] text-ink-soft"
          >
            {conversation.status === "open" ? "Close chat" : "Reopen"}
          </button>
        </div>

        {showDetails ? (
          <div className="flex-1 overflow-y-auto lg:hidden">
            <Details conversation={conversation} visitor={visitor} />
          </div>
        ) : (
          <>
            <Thread messages={messages} />
            <Reply onSend={send} closed={conversation.status === "closed"} />
          </>
        )}
      </section>
      <aside className="hidden w-[340px] shrink-0 overflow-y-auto border-l border-line bg-paper lg:block">
        <Details conversation={conversation} visitor={visitor} />
      </aside>
    </div>
  );
}

function Thread({ messages }: { messages: Message[] }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [messages.length]);
  return (
    <div role="log" aria-live="polite" className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
      {messages.map((m) =>
        m.sender === "system" ? (
          <p key={m.id} className="text-center text-[12px] text-muted">
            {m.body}
          </p>
        ) : (
          <div key={m.id} className={`flex flex-col ${m.sender === "agent" ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[80%] whitespace-pre-wrap break-words rounded-lg px-3.5 py-2 text-[14px] leading-relaxed ${
                m.sender === "agent" ? "rounded-br-sm bg-navy text-white" : "rounded-bl-sm bg-bubble text-ink"
              }`}
            >
              {m.body}
            </div>
            <span className="mx-1 mt-0.5 text-[10px] text-muted">{clock(m.at)}</span>
          </div>
        ),
      )}
      <div ref={end} />
    </div>
  );
}

function Reply({ onSend, closed }: { onSend: (text: string) => Promise<boolean>; closed: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await onSend(value);
    setBusy(false);
    if (ok) setText("");
    else setFailed(true);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="border-t border-line px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      {closed && <p className="mb-2 text-[12px] text-muted">This chat is closed. Replying reopens it.</p>}
      {failed && <p className="mb-2 text-[12px] text-danger">That didn&rsquo;t send. Try again.</p>}
      <div className="flex items-end gap-2">
        <label htmlFor="reply" className="sr-only">
          Reply
        </label>
        <textarea
          id="reply"
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
          placeholder="Reply"
          className="max-h-40 min-h-[44px] flex-1 resize-none rounded-sm border border-line bg-paper px-3 py-2.5 text-[15px] outline-none focus:border-navy"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="h-[44px] rounded-sm bg-navy px-4 text-[13px] font-medium uppercase tracking-[0.08em] text-white disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </form>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1.5">
      <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-[13px] text-ink">{children}</dd>
    </div>
  );
}

function Details({ conversation: c, visitor: v }: { conversation: Conversation; visitor: Visitor }) {
  const link = (url: string | null, title: string | null) =>
    url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-2">
        {title || pagePath(url)}
      </a>
    ) : (
      "Unknown"
    );

  return (
    <div className="space-y-5 px-4 py-4">
      <section>
        <h2 className="font-display text-[16px]">Right now</h2>
        <dl className="mt-1">
          <Row label="Status">
            {v.online ? <span className="text-ok">Online</span> : `Last seen ${ago(v.last_seen_at)}`}
          </Row>
          <Row label="Site">{siteName(v.current_site)}</Row>
          <Row label="Page">{link(v.current_url, v.current_title)}</Row>
          <Row label="Location">{place(v) || "Unknown"}</Row>
          <Row label="IP address">{v.ip || "Unknown"}</Row>
        </dl>
      </section>

      <section>
        <h2 className="font-display text-[16px]">This chat</h2>
        <dl className="mt-1">
          <Row label="Started on">{siteName(c.site)}</Row>
          <Row label="Started from">{link(c.start_url, c.start_title)}</Row>
          <Row label="Started">{new Date(c.created_at).toLocaleString()}</Row>
          <Row label="Location then">{place(c) || "Unknown"}</Row>
          <Row label="IP then">{c.ip || "Unknown"}</Row>
        </dl>
      </section>

      {c.prechat.length > 0 && (
        <section>
          <h2 className="font-display text-[16px]">Answers</h2>
          <dl className="mt-1">
            {c.prechat.map((a) => (
              <Row key={a.key} label={a.label.length > 60 ? `${a.label.slice(0, 57)}…` : a.label}>
                {a.key === "email" ? (
                  <a href={`mailto:${a.value}`} className="underline">{a.value}</a>
                ) : a.key === "phone" ? (
                  <a href={`tel:${a.value.replace(/[^+\d]/g, "")}`} className="underline">{a.value}</a>
                ) : (
                  a.value
                )}
              </Row>
            ))}
          </dl>
        </section>
      )}

      <section>
        <h2 className="font-display text-[16px]">Visitor</h2>
        <dl className="mt-1">
          <Row label="Device">{device(v.user_agent)}</Row>
          <Row label="First visit">{new Date(v.created_at).toLocaleDateString()} on {siteName(v.first_site)}</Row>
          <Row label="Came from">{v.referrer ? link(v.referrer, null) : "Direct or unknown"}</Row>
          <Row label="Chats">{v.chats}</Row>
        </dl>
      </section>
    </div>
  );
}
