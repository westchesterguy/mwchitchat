"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApi, ago, countryName, pagePath, poll, siteShort } from "./util";

interface Row {
  id: string;
  site: string;
  status: "open" | "closed";
  last_message_at: string;
  name: string | null;
  email: string | null;
  country: string | null;
  city: string | null;
  current_site: string | null;
  current_url: string | null;
  current_title: string | null;
  online: boolean;
  unread: boolean;
  preview: string | null;
}

export function Inbox() {
  const [status, setStatus] = useState<"open" | "closed">("open");
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    setRows(null);
    return poll(async () => {
      const { ok, data } = await adminApi<{ conversations: Row[] }>(`/api/admin/conversations?status=${status}`);
      if (ok) setRows(data.conversations);
    }, 4000);
  }, [status]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex gap-2 px-4 pt-4">
        {(["open", "closed"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-full px-3.5 py-1.5 text-[12px] uppercase tracking-[0.08em] ${
              status === s ? "bg-ink text-white" : "border border-line text-ink-soft"
            }`}
          >
            {s === "open" ? "Open" : "Closed"}
          </button>
        ))}
      </div>

      {rows === null && <p className="px-4 py-10 text-center text-[14px] text-muted">Loading…</p>}
      {rows?.length === 0 && (
        <p className="px-4 py-10 text-center text-[14px] text-muted">
          {status === "open" ? "No open chats." : "No closed chats yet."}
        </p>
      )}

      <ul className="mt-3 divide-y divide-line border-y border-line bg-white">
        {rows?.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/c/${r.id}`} className="flex gap-3 px-4 py-3.5 hover:bg-paper">
              <span
                aria-label={r.unread ? "Unread" : undefined}
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${r.unread ? "bg-navy" : "bg-transparent"}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className={`truncate text-[15px] ${r.unread ? "font-semibold" : "font-medium"}`}>
                    {r.name || r.email || "Visitor"}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] text-muted">{ago(r.last_message_at)}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                  <span className="rounded-sm bg-bubble px-1.5 py-0.5 text-ink-soft">{siteShort(r.site)}</span>
                  {(r.city || r.country) && <span>{[r.city, countryName(r.country)].filter(Boolean).join(", ")}</span>}
                </div>
                {r.preview && <p className="mt-1 truncate text-[13px] text-ink-soft">{r.preview}</p>}
                {r.online && (
                  <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-ok">
                    <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-ok" />
                    Online now: {r.current_title || pagePath(r.current_url)}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
