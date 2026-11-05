"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { siteShort } from "../admin/util";
import { ChevronDownIcon, DownloadIcon, ExternalIcon, SearchIcon } from "../ui/icons";
import { card, devApi, duration, input, secondary, when } from "./api";

interface Lead {
  id: string;
  created_at: string;
  site: string;
  status: "open" | "closed";
  start_url: string | null;
  start_title: string | null;
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  started_away: boolean;
  prechat: { key: string; label: string; value: string }[];
  name: string | null;
  email: string | null;
  phone: string | null;
  messages: number;
  first_reply_at: string | null;
  town: string | null;
}

const SITES = [
  { id: "", label: "All sites" },
  { id: "westchesterguy", label: "westchesterguy.com" },
  { id: "horse", label: "westchesterhorseproperties.com" },
];

function place(l: Lead) {
  return [l.city, l.region, l.country].filter(Boolean).join(", ") || "Unknown";
}

function path(url: string | null) {
  if (!url) return "";
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/** Every chat as a lead: search, filter by site and date, open the chat, export to CSV. */
export function Leads() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [site, setSite] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ total: number; leads: Lead[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  // Search as you type, after a short pause.
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (site) p.set("site", site);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p;
  }, [query, site, from, to]);

  useEffect(() => setPage(0), [params]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const p = new URLSearchParams(params);
    p.set("page", String(page));
    devApi<{ total: number; leads: Lead[] }>(`leads?${p}`).then(({ ok, data }) => {
      if (!live) return;
      setLoading(false);
      if (ok) setData(data);
    });
    return () => {
      live = false;
    };
  }, [params, page]);

  const total = data?.total ?? 0;
  const start = page * 50;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Search leads</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, email, phone, page or town"
            className={`${input} w-full pl-10`}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-muted">
          Site
          <select value={site} onChange={(e) => setSite(e.target.value)} className={`${input} pr-8`}>
            {SITES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-muted">
          From
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-muted">
          To
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={input} />
        </label>
        <a href={`/developer/api/leads/export?${params}`} className={secondary} download>
          <DownloadIcon className="h-4 w-4" /> Export CSV
        </a>
      </div>

      <div className={`${card} !p-0 transition-opacity ${loading && data ? "opacity-60" : ""}`}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
          <p className="text-[14px] font-medium text-ink">
            {data ? `${total.toLocaleString()} ${total === 1 ? "lead" : "leads"}` : "Loading leads"}
          </p>
          {total > 50 && (
            <div className="flex items-center gap-2 text-[13px] text-muted">
              <span className="tabular-nums">
                {start + 1}&ndash;{Math.min(start + 50, total)} of {total.toLocaleString()}
              </span>
              <button type="button" className={`${secondary} !h-8 !px-3`} disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <button
                type="button"
                className={`${secondary} !h-8 !px-3`}
                disabled={start + 50 >= total}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                <th className="px-4 py-2.5 font-semibold sm:pl-5">Date</th>
                <th className="px-3 py-2.5 font-semibold">Name</th>
                <th className="px-3 py-2.5 font-semibold">Contact</th>
                <th className="px-3 py-2.5 font-semibold">Site</th>
                <th className="px-3 py-2.5 font-semibold">Started on</th>
                <th className="px-3 py-2.5 font-semibold">Location</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 text-right font-semibold">Msgs</th>
                <th className="px-4 py-2.5 sm:pr-5" />
              </tr>
            </thead>
            <tbody>
              {data?.leads.map((l) => {
                const expanded = open === l.id;
                const answers = l.prechat.filter((a) => !["name", "email", "phone"].includes(a.key));
                return (
                  <Fragment key={l.id}>
                    <tr
                      onClick={() => setOpen(expanded ? null : l.id)}
                      className={`cursor-pointer border-b border-line align-top transition-colors hover:bg-paper ${expanded ? "bg-paper" : ""}`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-muted sm:pl-5">{when(l.created_at)}</td>
                      <td className="px-3 py-3 font-medium text-ink">{l.name || <span className="text-faint">No name</span>}</td>
                      <td className="px-3 py-3">
                        {l.email && (
                          <a href={`mailto:${l.email}`} onClick={(e) => e.stopPropagation()} className="block text-accent hover:underline">
                            {l.email}
                          </a>
                        )}
                        {l.phone && (
                          <a
                            href={`tel:${l.phone.replace(/[^+\d]/g, "")}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block text-ink-soft hover:underline"
                          >
                            {l.phone}
                          </a>
                        )}
                        {!l.email && !l.phone && <span className="text-faint">None given</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span className="whitespace-nowrap rounded-md bg-canvas px-1.5 py-0.5 text-[12px] font-medium text-ink-soft">
                          {siteShort(l.site)}
                        </span>
                      </td>
                      <td className="max-w-[220px] px-3 py-3">
                        {l.town && (
                          <span className="mr-1.5 inline-block rounded-md bg-navy-tint px-1.5 py-0.5 text-[12px] font-medium text-accent">
                            {l.town}
                          </span>
                        )}
                        <span className="line-clamp-2 text-ink-soft">{l.start_title || path(l.start_url) || "Unknown"}</span>
                      </td>
                      <td className="px-3 py-3 text-ink-soft">{place(l)}</td>
                      <td className="px-3 py-3">
                        <span className={`text-[12px] font-medium ${l.status === "open" ? "text-ok" : "text-muted"}`}>
                          {l.status === "open" ? "Open" : "Closed"}
                        </span>
                        {l.started_away && <span className="block text-[11px] text-faint">While away</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink-soft">{l.messages}</td>
                      <td className="px-4 py-3 text-right sm:pr-5">
                        <ChevronDownIcon className={`ml-auto h-4 w-4 text-faint transition-transform ${expanded ? "rotate-180" : ""}`} />
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-line bg-paper">
                        <td colSpan={9} className="px-4 pb-4 pt-1 sm:px-5">
                          <div className="anim-fade grid gap-x-8 gap-y-3 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
                            <dl className="space-y-1.5">
                              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Answers</dt>
                              {answers.length ? (
                                answers.map((a) => (
                                  <dd key={a.key} className="text-ink-soft">
                                    <span className="text-muted">{a.key === "sms_consent" ? "Text messages" : a.label}: </span>
                                    {a.value}
                                  </dd>
                                ))
                              ) : (
                                <dd className="text-faint">Only name and contact details</dd>
                              )}
                            </dl>
                            <dl className="space-y-1.5">
                              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Where it started</dt>
                              <dd className="break-all text-ink-soft">
                                {l.start_url ? (
                                  <a href={l.start_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                                    {l.start_url}
                                  </a>
                                ) : (
                                  "Unknown page"
                                )}
                              </dd>
                              <dd className="text-ink-soft">IP address {l.ip || "unknown"}</dd>
                            </dl>
                            <dl className="space-y-1.5">
                              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Response</dt>
                              <dd className="text-ink-soft">
                                {l.first_reply_at
                                  ? `First reply ${duration((new Date(l.first_reply_at).getTime() - new Date(l.created_at).getTime()) / 1000)} after the chat started`
                                  : "Not replied to yet"}
                              </dd>
                              <dd>
                                <a
                                  href={`/admin/c/${l.id}`}
                                  target="_blank"
                                  rel="noopener"
                                  className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline"
                                >
                                  Open the chat <ExternalIcon className="h-3.5 w-3.5" />
                                </a>
                              </dd>
                            </dl>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {data && data.leads.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-14 text-center text-[14px] text-muted">
                    {query || site || from || to ? "No leads match these filters." : "No leads yet. They appear here when a visitor starts a chat."}
                  </td>
                </tr>
              )}
              {!data &&
                [0, 1, 2, 3, 4].map((i) => (
                  <tr key={i} className="border-b border-line">
                    <td colSpan={9} className="px-5 py-3.5">
                      <span className="skeleton block h-4 w-full" />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
