"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Composer } from "../chat/Composer";
import { Thread } from "../chat/Thread";
import { ago } from "../chat/time";
import { useMessages, type ChatMessage } from "../chat/useMessages";
import { Avatar } from "../ui/Avatar";
import {
  BackIcon,
  ChatIcon,
  DeviceIcon,
  GlobeIcon,
  InfoIcon,
  LinkIcon,
  MailIcon,
  PhoneIcon,
  PinIcon,
} from "../ui/icons";
import { Menu, type MenuItem } from "../ui/Menu";
import { Sheet } from "../ui/Sheet";
import { chime } from "./tones";
import { adminApi, device, pagePath, place, poll, siteName } from "./util";

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
  const [missing, setMissing] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [pane, setPane] = useState(true);
  const { messages, lastId, merge, optimistic, settle, remove } = useMessages();
  const loaded = useRef(false);

  useEffect(
    () =>
      poll(async () => {
        const { ok, status, data } = await adminApi<{
          conversation: Conversation;
          visitor: Visitor;
          messages: ChatMessage[];
        }>(`/api/admin/conversations/${id}?after=${lastId.current}`);
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

  const send = async (text: string) => {
    const temp = optimistic("agent", text);
    const { ok, data } = await adminApi<{ message: ChatMessage }>(`/api/admin/conversations/${id}/messages`, "POST", {
      body: text,
    });
    settle(temp, ok ? data.message : null);
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

  if (missing) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-canvas px-8 text-center">
        <p className="text-[15px] font-medium">This chat no longer exists.</p>
        <Link href="/admin" className="press mt-4 rounded-full bg-navy px-5 py-2.5 text-[14px] font-medium text-white">
          Back to chats
        </Link>
      </div>
    );
  }

  const name = visitor?.name || visitor?.email || "Visitor";
  const menu: MenuItem[] = [
    ...(visitor?.email ? [{ label: "Email visitor", icon: <MailIcon className="h-[18px] w-[18px]" />, href: `mailto:${visitor.email}` }] : []),
    ...(visitor?.phone
      ? [{ label: "Call visitor", icon: <PhoneIcon className="h-[18px] w-[18px]" />, href: `tel:${visitor.phone.replace(/[^+\d]/g, "")}` }]
      : []),
    conversation?.status === "closed"
      ? { label: "Reopen chat", icon: <ChatIcon className="h-[18px] w-[18px]" />, onSelect: () => setStatus("open") }
      : { label: "Close chat", icon: <ChatIcon className="h-[18px] w-[18px]" />, onSelect: () => setStatus("closed"), danger: true },
  ];

  return (
    <div className="anim-screen flex min-h-0 min-w-0 flex-1">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-canvas">
        <header className="on-navy flex items-center gap-2 bg-chrome px-2 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] text-white sm:px-3">
          <Link href="/admin" aria-label="Back to chats" className="press rounded-full p-2 hover:bg-white/10 lg:hidden">
            <BackIcon className="h-6 w-6" />
          </Link>
          <button
            type="button"
            onClick={toggleDetails}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left lg:pl-2"
          >
            {visitor ? (
              <Avatar name={name} online={visitor.online} ring="var(--color-chrome)" />
            ) : (
              <span className="skeleton h-11 w-11 !rounded-full opacity-30" />
            )}
            <span className="min-w-0">
              <span className="block truncate text-[16px] font-semibold">{visitor ? name : "Loading…"}</span>
              <span className="block truncate text-[12px] text-white/70">
                {!visitor
                  ? ""
                  : visitor.online
                    ? `Online · ${visitor.current_title || pagePath(visitor.current_url) || siteName(visitor.current_site)}`
                    : `Last seen ${ago(visitor.last_seen_at)}`}
              </span>
            </span>
          </button>
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
            otherAvatar={<Avatar name={name} size="sm" />}
            onRetry={(m) => {
              remove(m.id);
              send(m.body);
            }}
          />
        ) : (
          <div className="flex-1 space-y-3 px-5 py-6" aria-hidden>
            <span className="skeleton block h-10 w-2/3 !rounded-2xl" />
            <span className="skeleton ml-auto block h-10 w-1/2 !rounded-2xl" />
            <span className="skeleton block h-10 w-3/5 !rounded-2xl" />
          </div>
        )}

        <Composer
          onSend={send}
          placeholder="Reply"
          autoFocus
          note={conversation?.status === "closed" ? "This chat is closed. Replying reopens it." : undefined}
        />
      </section>

      {pane && conversation && visitor && (
        <aside className="scroll-thin hidden w-[340px] shrink-0 overflow-y-auto border-l border-line bg-paper xl:block">
          <div className="px-5 pb-1 pt-5">
            <h2 className="text-[17px] font-semibold">Details</h2>
          </div>
          <Details conversation={conversation} visitor={visitor} />
        </aside>
      )}

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Details">
        {conversation && visitor && <Details conversation={conversation} visitor={visitor} />}
      </Sheet>
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5">
      <span className="mt-0.5 text-faint">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-[12px] text-muted">{label}</dt>
        <dd className="mt-0.5 break-words text-[14px] text-ink">{children}</dd>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface px-4 py-2 shadow-[var(--shadow-bubble)]">
      <h3 className="pb-1 pt-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{title}</h3>
      <dl className="divide-y divide-line/70">{children}</dl>
    </section>
  );
}

function Details({ conversation: c, visitor: v }: { conversation: Conversation; visitor: Visitor }) {
  const link = (url: string | null, title: string | null) =>
    url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent underline decoration-navy/30 underline-offset-2">
        {title || pagePath(url)}
      </a>
    ) : (
      "Unknown"
    );
  const icon = "h-[18px] w-[18px]";
  const name = v.name || v.email || "Visitor";

  return (
    <div className="space-y-3 px-4 pb-6 pt-2">
      <div className="flex flex-col items-center pb-2 pt-1 text-center">
        <Avatar name={name} size="lg" online={v.online} ring="var(--color-paper)" />
        <p className="mt-2 text-[17px] font-semibold">{name}</p>
        <p className={`text-[13px] ${v.online ? "text-ok" : "text-muted"}`}>
          {v.online ? "Online now" : `Last seen ${ago(v.last_seen_at)}`}
        </p>
        {(v.email || v.phone) && (
          <div className="mt-3 flex gap-2">
            {v.email && (
              <a href={`mailto:${v.email}`} className="press flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-[13px] font-medium text-accent shadow-[var(--shadow-bubble)]">
                <MailIcon className="h-4 w-4" /> Email
              </a>
            )}
            {v.phone && (
              <a href={`tel:${v.phone.replace(/[^+\d]/g, "")}`} className="press flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-[13px] font-medium text-accent shadow-[var(--shadow-bubble)]">
                <PhoneIcon className="h-4 w-4" /> Call
              </a>
            )}
          </div>
        )}
      </div>

      <Card title="Right now">
        <Row icon={<GlobeIcon className={icon} />} label="Site">{siteName(v.current_site)}</Row>
        <Row icon={<LinkIcon className={icon} />} label="Page">{link(v.current_url, v.current_title)}</Row>
        <Row icon={<PinIcon className={icon} />} label="Location">{place(v) || "Unknown"}</Row>
        <Row icon={<DeviceIcon className={icon} />} label="IP address">{v.ip || "Unknown"}</Row>
      </Card>

      {c.prechat.length > 0 && (
        <Card title="Answers">
          {c.prechat.map((a) => (
            <div key={a.key} className="py-2.5">
              <dt className="text-[12px] text-muted">{a.label.length > 70 ? `${a.label.slice(0, 67)}…` : a.label}</dt>
              <dd className="mt-0.5 break-words text-[14px]">
                {a.key === "email" ? (
                  <a href={`mailto:${a.value}`} className="text-accent underline decoration-navy/30 underline-offset-2">{a.value}</a>
                ) : a.key === "phone" ? (
                  <a href={`tel:${a.value.replace(/[^+\d]/g, "")}`} className="text-accent underline decoration-navy/30 underline-offset-2">{a.value}</a>
                ) : (
                  a.value
                )}
              </dd>
            </div>
          ))}
        </Card>
      )}

      <Card title="This chat">
        <Row icon={<GlobeIcon className={icon} />} label="Started on">{siteName(c.site)}</Row>
        <Row icon={<LinkIcon className={icon} />} label="Started from">{link(c.start_url, c.start_title)}</Row>
        <Row icon={<ChatIcon className={icon} />} label="Started">{new Date(c.created_at).toLocaleString()}</Row>
        <Row icon={<PinIcon className={icon} />} label="Location then">{place(c) || "Unknown"}</Row>
        <Row icon={<DeviceIcon className={icon} />} label="IP then">{c.ip || "Unknown"}</Row>
      </Card>

      <Card title="Visitor">
        <Row icon={<DeviceIcon className={icon} />} label="Device">{device(v.user_agent)}</Row>
        <Row icon={<GlobeIcon className={icon} />} label="First visit">
          {new Date(v.created_at).toLocaleDateString()} on {siteName(v.first_site)}
        </Row>
        <Row icon={<LinkIcon className={icon} />} label="Came from">{v.referrer ? link(v.referrer, null) : "Direct or unknown"}</Row>
        <Row icon={<ChatIcon className={icon} />} label="Chats">{v.chats}</Row>
      </Card>
    </div>
  );
}
