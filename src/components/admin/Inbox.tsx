"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { listTime } from "../chat/time";
import { Avatar } from "../ui/Avatar";
import { ChatIcon, SearchIcon } from "../ui/icons";
import { chime } from "./tones";
import { adminApi, countryName, pagePath, poll, siteShort } from "./util";

interface Row {
  id: string;
  site: string;
  status: "open" | "closed";
  last_message_at: string;
  name: string | null;
  email: string | null;
  country: string | null;
  city: string | null;
  current_title: string | null;
  current_url: string | null;
  online: boolean;
  unread: number;
  preview: string | null;
  last_sender: "visitor" | "agent" | null;
  last_ai: boolean | null;
}

function Skeleton() {
  return (
    <ul aria-hidden className="px-4">
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className="flex gap-3 py-3.5">
          <span className="skeleton h-11 w-11 shrink-0 !rounded-full" />
          <span className="flex-1 space-y-2 pt-1">
            <span className="skeleton block h-3.5 w-2/5" />
            <span className="skeleton block h-3 w-4/5" />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The chat list: search, and one row per conversation, open and closed together. */
export function Inbox({ activeId }: { activeId: string | null }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [query, setQuery] = useState("");
  const active = useRef(activeId);
  active.current = activeId;
  const heard = useRef<number | null>(null);

  useEffect(
    () =>
      poll(async () => {
        const { ok, data } = await adminApi<{ conversations: Row[] }>("/api/admin/conversations");
        if (!ok) return;
        setRows(data.conversations);
        // A new chat or a new message in a chat you are not looking at.
        const total = data.conversations.reduce((n, r) => n + (r.id === active.current ? 0 : r.unread), 0);
        if (heard.current !== null && total > heard.current) chime();
        heard.current = total;
      }, 4000),
    [],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!rows || !q) return rows;
    return rows.filter((r) =>
      [r.name, r.email, r.preview, r.city, siteShort(r.site)].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line px-4 pb-3 pt-3">
        <label className="relative block">
          <span className="sr-only">Search chats</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-10 w-full rounded-xl bg-canvas pl-10 pr-3 text-[15px] outline-none placeholder:text-faint focus:bg-surface focus:shadow-[0_0_0_2px_rgba(0,35,73,0.18)]"
          />
        </label>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {shown === null && <Skeleton />}
        {shown?.length === 0 && (
          <div className="anim-fade flex flex-col items-center px-8 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-navy-tint text-accent">
              <ChatIcon className="h-7 w-7" />
            </span>
            <p className="mt-4 text-[15px] font-medium">
              {query ? "No chats match" : "No chats yet"}
            </p>
            <p className="mt-1 text-[13px] text-muted">
              {query ? "Try a name, email or town." : "When a visitor starts a chat on either site, it appears here."}
            </p>
          </div>
        )}
        <ul>
          {shown?.map((r) => {
            const unread = r.id === activeId ? 0 : r.unread;
            const active = r.id === activeId;
            const name = r.name || r.email || "Visitor";
            return (
              <li key={r.id}>
                <Link
                  href={`/chatapp/c/${r.id}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex gap-3 px-4 py-3 transition-colors ${
                    active ? "bg-navy-tint" : "hover:bg-paper active:bg-canvas"
                  }`}
                >
                  <Avatar name={name} online={r.online} ring={active ? "var(--color-navy-tint)" : "var(--color-surface)"} />
                  <div className="min-w-0 flex-1 border-b border-line/0">
                    <div className="flex items-baseline gap-2">
                      <span className={`truncate text-[15px] ${unread ? "font-semibold text-ink" : "font-medium text-ink"}`}>
                        {name}
                      </span>
                      <span className={`ml-auto shrink-0 text-[12px] ${unread ? "font-semibold text-accent" : "text-faint"}`}>
                        {listTime(r.last_message_at)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className={`min-w-0 flex-1 truncate text-[14px] ${unread ? "text-ink" : "text-muted"}`}>
                        {r.last_sender === "agent" && <span className="text-faint">{r.last_ai ? "Assistant: " : "You: "}</span>}
                        {r.preview ?? ""}
                      </p>
                      {unread > 0 && (
                        <span className="anim-pop flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-navy px-1.5 text-[11px] font-semibold text-white">
                          {unread}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-faint">
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-[0.06em] ${
                          r.status === "open" ? "bg-ok/12 text-ok" : "bg-canvas text-muted"
                        }`}
                      >
                        {r.status === "open" ? "OPEN" : "CLOSED"}
                      </span>
                      <span className="shrink-0 whitespace-nowrap rounded-md bg-canvas px-1.5 py-0.5 font-medium text-ink-soft">{siteShort(r.site)}</span>
                      {r.online ? (
                        <span className="truncate text-ok">On {r.current_title || pagePath(r.current_url)}</span>
                      ) : (
                        (r.city || r.country) && (
                          <span className="truncate">{[r.city, countryName(r.country)].filter(Boolean).join(", ")}</span>
                        )
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
