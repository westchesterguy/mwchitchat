"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { postMessage, type Outgoing } from "../chat/attach";
import { Composer } from "../chat/Composer";
import { Thread } from "../chat/Thread";
import { ago } from "../chat/time";
import { useMessages, type ChatMessage } from "../chat/useMessages";
import { Avatar } from "../ui/Avatar";
import { BackIcon, ChatIcon, GlobeIcon, InfoIcon, MailIcon, PhoneIcon, SparkleIcon, Spinner } from "../ui/icons";
import { Menu, type MenuItem } from "../ui/Menu";
import { Sheet } from "../ui/Sheet";
import { chime } from "./tones";
import { adminApi, device, pagePath, place, poll, siteName } from "./util";

const contactButton =
  "press inline-flex h-7 items-center gap-1.5 rounded-full bg-white/15 px-3 text-[12px] font-semibold text-white hover:bg-white/25";

interface Conversation {
  id: string;
  ai_paused: boolean;
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

const EMAIL_IN_TEXT = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
// (914) 555-0100, 914-555-0100, 914.555.0100, +1 914 555 0100, or an
// international number written with a leading +.
const PHONE_IN_TEXT =
  /(?<![\w$])(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.-]?)\d{3}[\s.-]?\d{4}(?!\d)|(?<![\w$])\+\d(?:[\s.-]?\d){7,14}(?!\d)/;

/**
 * How to reach the visitor: what they gave in the pre-chat questions, or
 * else the latest phone number or email they typed in the chat.
 */
function contactOf(visitor: { email: string | null; phone: string | null } | null, messages: ChatMessage[]) {
  let email = visitor?.email || null;
  let phone = visitor?.phone || null;
  for (let i = messages.length - 1; i >= 0 && (!email || !phone); i--) {
    const m = messages[i];
    if (m.sender !== "visitor" || !m.body) continue;
    email ??= m.body.match(EMAIL_IN_TEXT)?.[0] ?? null;
    phone ??= m.body.match(PHONE_IN_TEXT)?.[0].trim() ?? null;
  }
  return { email, phone };
}

const telHref = (phone: string) => `tel:${phone.replace(/[^+\d]/g, "")}`;

export function ConversationView({ id }: { id: string }) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [missing, setMissing] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [pane, setPane] = useState(true);
  const { messages, lastId, merge, optimistic, settle, remove } = useMessages();
  const loaded = useRef(false);

  // Taps, typing and scrolling: proof someone is at this screen.
  const lastUsed = useRef(Date.now());
  useEffect(() => {
    const used = () => (lastUsed.current = Date.now());
    const events = ["pointerdown", "keydown", "wheel", "touchstart", "focus"] as const;
    events.forEach((e) => window.addEventListener(e, used, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, used));
  }, []);

  useEffect(
    () =>
      poll(async () => {
        // Only then does the phone stay quiet for this chat's new messages.
        const watching = document.hasFocus() && Date.now() - lastUsed.current < 120_000;
        const { ok, status, data } = await adminApi<{
          conversation: Conversation;
          visitor: Visitor;
          messages: ChatMessage[];
        }>(`/api/admin/conversations/${id}?after=${lastId.current}${watching ? "&watching=1" : ""}`);
        if (status === 404) setMissing(true);
        if (!ok) return;
        const fromVisitor = data.messages.some((m) => m.sender === "visitor" && m.id > lastId.current);
        if (loaded.current && fromVisitor) chime();
        loaded.current = true;
        setConversation(data.conversation);
        setVisitor(data.visitor);
        merge(data.messages);
      }, 2500),
    [id, merge, lastId],
  );

  const send = async (text: string, file: Outgoing | null = null) => {
    const temp = optimistic("agent", text, file);
    const { ok, status, data } = await postMessage<{ message?: ChatMessage }>(`/api/admin/conversations/${id}/messages`, text, file);
    if (status === 401) window.location.href = "/chatapp/login";
    settle(temp, ok && data.message ? data.message : null);
    if (ok) setConversation((c) => (c ? { ...c, status: "open" } : c));
  };

  const setStatus = async (status: "open" | "closed") => {
    const { ok } = await adminApi(`/api/admin/conversations/${id}/status`, "POST", { status });
    if (ok) setConversation((c) => (c ? { ...c, status } : c));
  };

  const toggleDetails = () => {
    if (window.matchMedia("(min-width: 1280px)").matches) setPane((p) => !p);
    else setSheet(true);
  };

  const reach = useMemo(() => contactOf(visitor, messages), [visitor, messages]);

  // The AI assistant, when it is switched on in the developer page.
  const [ai, setAi] = useState<{ enabled: boolean; mode: string; name: string } | null>(null);
  const [draft, setDraft] = useState<{ text: string; n: number } | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  useEffect(() => {
    adminApi<{ ai?: { enabled: boolean; mode: string; name: string } }>("/api/admin/settings").then(
      ({ ok, data }) => ok && data.ai && setAi(data.ai),
    );
  }, []);
  const suggest = async () => {
    setDrafting(true);
    setDraftError(null);
    const { ok, data } = await adminApi<{ text?: string; message?: string }>(`/api/admin/conversations/${id}/draft`, "POST", {});
    setDrafting(false);
    if (ok && data.text) setDraft({ text: data.text, n: Date.now() });
    else setDraftError(data.message ?? "No suggestion this time.");
  };
  const setAssistant = async (paused: boolean) => {
    const { ok } = await adminApi(`/api/admin/conversations/${id}/assistant`, "POST", { paused });
    if (ok) setConversation((c) => (c ? { ...c, ai_paused: paused } : c));
  };

  if (missing) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-canvas px-8 text-center">
        <p className="text-[15px] font-medium">This chat no longer exists.</p>
        <Link href="/chatapp" className="press mt-4 rounded-full bg-navy px-5 py-2.5 text-[14px] font-medium text-white">
          Back to chats
        </Link>
      </div>
    );
  }

  const name = visitor?.name || visitor?.email || "Visitor";
  const menu: MenuItem[] = [
    ...(reach.email ? [{ label: "Email visitor", icon: <MailIcon className="h-[18px] w-[18px]" />, href: `mailto:${reach.email}` }] : []),
    ...(reach.phone ? [{ label: "Call visitor", icon: <PhoneIcon className="h-[18px] w-[18px]" />, href: telHref(reach.phone) }] : []),
    ...(ai?.enabled && ai.mode !== "drafts" && conversation
      ? [
          conversation.ai_paused
            ? { label: `Let ${ai.name} answer here`, icon: <SparkleIcon className="h-[18px] w-[18px]" />, onSelect: () => setAssistant(false) }
            : { label: `Keep ${ai.name} out of this chat`, icon: <SparkleIcon className="h-[18px] w-[18px]" />, onSelect: () => setAssistant(true) },
        ]
      : []),
    conversation?.status === "closed"
      ? { label: "Reopen chat", icon: <ChatIcon className="h-[18px] w-[18px]" />, onSelect: () => setStatus("open") }
      : { label: "Close chat", icon: <ChatIcon className="h-[18px] w-[18px]" />, onSelect: () => setStatus("closed"), danger: true },
  ];

  return (
    <div className="anim-screen flex min-h-0 min-w-0 flex-1">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-canvas">
        <header className="on-navy flex items-center gap-2 bg-chrome px-2 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] text-white sm:px-3">
          <Link href="/chatapp" aria-label="Back to chats" className="press rounded-full p-2 hover:bg-white/10 lg:hidden">
            <BackIcon className="h-6 w-6" />
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-3 px-1 py-1 lg:pl-2">
            <button type="button" onClick={toggleDetails} tabIndex={-1} aria-hidden className="shrink-0">
              {visitor ? (
                <Avatar name={name} online={visitor.online} ring="var(--color-chrome)" />
              ) : (
                <span className="skeleton block h-11 w-11 !rounded-full opacity-30" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <button type="button" onClick={toggleDetails} className="block w-full min-w-0 text-left">
                <span className="block truncate text-[16px] font-semibold">{visitor ? name : "Loading…"}</span>
                <span className="block truncate text-[12px] text-white/70">
                  {!visitor
                    ? ""
                    : visitor.online
                      ? `Online · ${visitor.current_title || pagePath(visitor.current_url) || siteName(visitor.current_site)}`
                      : `Last seen ${ago(visitor.last_seen_at)}`}
                </span>
              </button>
              {(reach.phone || reach.email) && (
                <div className="anim-fade mt-1.5 flex gap-1.5">
                  {reach.phone && (
                    <a href={telHref(reach.phone)} title={reach.phone} className={contactButton}>
                      <PhoneIcon className="h-3.5 w-3.5" strokeWidth={2} /> Call
                    </a>
                  )}
                  {reach.email && (
                    <a href={`mailto:${reach.email}`} title={reach.email} className={contactButton}>
                      <MailIcon className="h-3.5 w-3.5" strokeWidth={2} /> Email
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={toggleDetails}
            aria-label="Visitor details"
            className="press rounded-full p-2 hover:bg-white/10"
          >
            <InfoIcon className="h-[22px] w-[22px]" />
          </button>
          <Menu items={menu} buttonClass="text-white hover:bg-white/10" />
        </header>

        {conversation && (
          <div className="flex items-center justify-center gap-2 border-b border-line bg-paper px-4 py-1.5 text-[12px] text-muted">
            <GlobeIcon className="h-3.5 w-3.5" />
            Started on {siteName(conversation.site)}
            {conversation.status === "closed" && <span className="font-medium text-ink-soft">· Closed</span>}
          </div>
        )}

        {conversation ? (
          <Thread
            messages={messages}
            mine="agent"
            otherName={name}
            aiName={ai?.name}
            otherAvatar={<Avatar name={name} size="sm" />}
            onRetry={(m) => {
              remove(m.id);
              send(m.body, m.outgoing ?? null);
            }}
          />
        ) : (
          <div className="flex-1 space-y-3 px-5 py-6" aria-hidden>
            <span className="skeleton block h-10 w-2/3 !rounded-2xl" />
            <span className="skeleton ml-auto block h-10 w-1/2 !rounded-2xl" />
            <span className="skeleton block h-10 w-3/5 !rounded-2xl" />
          </div>
        )}

        {conversation?.status === "closed" ? (
          <ClosedPanel
            email={reach.email}
            phone={reach.phone}
            site={conversation.site}
            onReopen={() => setStatus("open")}
          />
        ) : (
        <Composer
          onSend={send}
          placeholder="Reply"
          autoFocus
          draft={draft}
          actions={
            ai?.enabled ? (
              <span className="flex items-center gap-2">
                {draftError && <span className="text-[12px] text-danger">{draftError}</span>}
                <button
                  type="button"
                  onClick={suggest}
                  disabled={drafting}
                  className="press inline-flex items-center gap-1.5 rounded-full bg-navy-tint px-3 py-1 text-[12px] font-semibold text-accent disabled:opacity-60"
                >
                  {drafting ? <Spinner className="h-3.5 w-3.5" /> : <SparkleIcon className="h-3.5 w-3.5" />} Suggest a reply
                </button>
              </span>
            ) : undefined
          }
        />
        )}
      </section>

      {pane && conversation && visitor && (
        <aside className="scroll-thin hidden w-[340px] shrink-0 overflow-y-auto border-l border-line bg-paper xl:block">
          <div className="px-5 pb-1 pt-5">
            <h2 className="text-[17px] font-semibold">Details</h2>
          </div>
          <Details conversation={conversation} visitor={visitor} reach={reach} />
        </aside>
      )}

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Details">
        {conversation && visitor && <Details conversation={conversation} visitor={visitor} reach={reach} />}
      </Sheet>
    </div>
  );
}

/**
 * In place of the reply bar on a closed chat: the visitor has gone, so the
 * way to reach them is email, or else a call or text, or there is none.
 */
function ClosedPanel({
  email,
  phone,
  site,
  onReopen,
}: {
  email: string | null;
  phone: string | null;
  site: string;
  onReopen: () => void;
}) {
  const subject = encodeURIComponent(`Following up on your chat on ${siteName(site)}`);
  const digits = phone?.replace(/[^+\d]/g, "") ?? "";
  const main =
    "press inline-flex h-11 items-center justify-center gap-2 rounded-full bg-navy px-5 text-[14px] font-semibold text-white shadow-[0_2px_8px_rgba(0,35,73,0.25)]";
  const other =
    "press inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 text-[14px] font-medium text-ink-soft";
  return (
    <div className="anim-rise border-t border-line bg-paper px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
      <p className="text-center text-[14px] font-semibold text-ink">This chat is closed</p>
      <p className="mx-auto mt-1 max-w-sm text-center text-[13px] text-muted">
        {email
          ? "Replies here won't reach them. Follow up by email instead."
          : phone
            ? "Replies here won't reach them, and they left no email. Call or text them instead."
            : "Replies here won't reach them, and this lead left no email or phone number, so there is no way to follow up outside the chat."}
      </p>
      {(email || phone) && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {email && (
            <a href={`mailto:${email}?subject=${subject}`} className={main}>
              <MailIcon className="h-[18px] w-[18px]" /> Reply by email
            </a>
          )}
          {phone && (
            <>
              <a href={`tel:${digits}`} className={email ? other : main}>
                <PhoneIcon className="h-[18px] w-[18px]" /> Call
              </a>
              <a href={`sms:${digits}`} className={other}>
                <ChatIcon className="h-[18px] w-[18px]" /> Text
              </a>
            </>
          )}
        </div>
      )}
      {(email || phone) && (
        <p className="mt-2 break-all text-center text-[12px] text-faint">{[email, phone].filter(Boolean).join(" · ")}</p>
      )}
      <p className="mt-3 text-center">
        <button type="button" onClick={onReopen} className="text-[12px] font-medium text-accent hover:underline">
          Reopen the chat instead
        </button>
      </p>
    </div>
  );
}

/** One line: the label on the left, the value beside it. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2.5">
      <dt className="w-[92px] shrink-0 text-[13px] text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-[14px] text-ink">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="px-1 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{title}</h3>
      <dl className="divide-y divide-line rounded-2xl bg-surface px-4 shadow-[var(--shadow-bubble)]">{children}</dl>
    </section>
  );
}

/** Short labels for questions whose full wording is long. */
function answerLabel(a: { key: string; label: string }): string {
  if (a.key === "sms_consent") return "Text messages";
  return a.label.length > 40 ? `${a.label.slice(0, 38)}…` : a.label;
}

/**
 * Where the chat started, IP address and location, the lead's answers, then
 * a short summary of the visitor.
 */
function Details({
  conversation: c,
  visitor: v,
  reach,
}: {
  conversation: Conversation;
  visitor: Visitor;
  reach: { email: string | null; phone: string | null };
}) {
  const link = (url: string | null, title: string | null) =>
    url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent underline decoration-accent/30 underline-offset-2">
        {title || pagePath(url)}
      </a>
    ) : (
      "Unknown"
    );
  const name = v.name || v.email || "Visitor";
  const button =
    "press flex flex-1 items-center justify-center gap-1.5 rounded-full bg-surface py-2 text-[13px] font-medium text-accent shadow-[var(--shadow-bubble)]";

  return (
    <div className="space-y-5 px-4 pb-6 pt-2">
      <div className="flex items-center gap-3 px-1">
        <Avatar name={name} online={v.online} ring="var(--color-paper)" />
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold">{name}</p>
          <p className={`text-[13px] ${v.online ? "text-ok" : "text-muted"}`}>
            {v.online ? "Online now" : `Last seen ${ago(v.last_seen_at)}`}
          </p>
        </div>
      </div>
      {(reach.email || reach.phone) && (
        <div className="-mt-1 flex gap-2">
          {reach.phone && (
            <a href={telHref(reach.phone)} className={button}>
              <PhoneIcon className="h-4 w-4" /> Call
            </a>
          )}
          {reach.email && (
            <a href={`mailto:${reach.email}`} className={button}>
              <MailIcon className="h-4 w-4" /> Email
            </a>
          )}
        </div>
      )}

      <Section title="Chat started on">
        <Row label="Site">{siteName(c.site)}</Row>
        <Row label="Page">{link(c.start_url, c.start_title)}</Row>
        <Row label="When">
          {new Date(c.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </Row>
        <Row label="IP address">{c.ip || v.ip || "Unknown"}</Row>
        <Row label="Location">{place(c) || place(v) || "Unknown"}</Row>
      </Section>

      {c.prechat.length > 0 && (
        <Section title="Lead details">
          {c.prechat.map((a) => (
            <Row key={a.key} label={answerLabel(a)}>
              {a.key === "email" ? (
                <a href={`mailto:${a.value}`} className="text-accent underline decoration-accent/30 underline-offset-2">{a.value}</a>
              ) : a.key === "phone" ? (
                <a href={`tel:${a.value.replace(/[^+\d]/g, "")}`} className="text-accent underline decoration-accent/30 underline-offset-2">{a.value}</a>
              ) : (
                a.value
              )}
            </Row>
          ))}
        </Section>
      )}

      <Section title="Visitor">
        <Row label="Now">
          {v.online ? link(v.current_url, v.current_title) : `Last seen ${ago(v.last_seen_at)}`}
        </Row>
        <Row label="Device">{device(v.user_agent)}</Row>
        <Row label="First visit">
          {new Date(v.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}, {siteName(v.first_site)}
        </Row>
        {v.referrer && <Row label="Came from">{link(v.referrer, null)}</Row>}
        <Row label="Chats">{v.chats}</Row>
      </Section>
    </div>
  );
}
