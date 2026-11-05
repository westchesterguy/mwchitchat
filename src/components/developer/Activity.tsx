"use client";

import { useEffect, useMemo, useState } from "react";
import { card, devApi, duration, h2, pct, plural, sub } from "./api";

interface Data {
  days: number;
  perDay: { day: string; site: string; n: number }[];
  pages: { url: string; title: string | null; n: number; town: string | null }[];
  hours: { hour: number; n: number }[];
  places: { place: string; n: number }[];
  totals: { chats: number; people: number; with_email: number; with_phone: number; while_away: number };
  reply: { chats: number; answered: number; median_seconds: number | null; within_five: number };
}

const SERIES = [
  { id: "westchesterguy", label: "westchesterguy.com", color: "var(--color-series-1)" },
  { id: "horse", label: "westchesterhorseproperties.com", color: "var(--color-series-2)" },
];

/** Today's date in Eastern time, as YYYY-MM-DD. */
function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

function shift(day: string, by: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
}

function label(day: string, withYear = false): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/** A round top for the axis: 1, 2 or 5 times a power of ten per step, four steps. */
function niceMax(max: number): { top: number; ticks: number[] } {
  if (max <= 4) return { top: 4, ticks: [0, 1, 2, 3, 4] };
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  const top = step * Math.ceil(max / step);
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return { top, ticks };
}

interface Bucket {
  key: string;
  title: string;
  axis: string;
  values: number[];
}

/** Columns from one baseline, a 2px gap between stacked parts, 4px round tops. */
function Columns({ buckets, series, height = 180 }: { buckets: Bucket[]; series: typeof SERIES; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...buckets.map((b) => b.values.reduce((a, v) => a + v, 0)));
  const { top, ticks } = niceMax(max);
  const every = Math.max(1, Math.ceil(buckets.length / 8));

  return (
    <div className="relative mt-4 flex gap-2" onMouseLeave={() => setHover(null)}>
      <div className="relative w-8 shrink-0 text-right text-[11px] tabular-nums text-faint" style={{ height }}>
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: height - (t / top) * height }}>
            {t.toLocaleString()}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height }}>
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 h-px bg-line" style={{ top: height - (t / top) * height }} />
          ))}
          <div className="absolute inset-0 flex items-end">
            {buckets.map((b, i) => {
              const total = b.values.reduce((a, v) => a + v, 0);
              const parts = b.values.map((v, s) => ({ v, s })).filter((p) => p.v > 0);
              return (
                <button
                  key={b.key}
                  type="button"
                  aria-label={`${b.title}: ${total} ${total === 1 ? "chat" : "chats"}`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="group relative flex h-full min-w-0 flex-1 items-end justify-center outline-none"
                >
                  <span
                    className={`flex w-[72%] max-w-[24px] flex-col-reverse gap-[2px] transition-opacity ${
                      hover !== null && hover !== i ? "opacity-55" : ""
                    }`}
                    style={{ height: `${(total / top) * 100}%` }}
                  >
                    {parts.map((p, j) => (
                      <span
                        key={p.s}
                        className={j === parts.length - 1 ? "rounded-t-[4px]" : ""}
                        style={{ flexGrow: p.v, flexBasis: 0, minHeight: 2, background: series[p.s].color }}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          {hover !== null && (
            <div
              className="pointer-events-none absolute -top-2 z-10 min-w-[150px] -translate-x-1/2 -translate-y-full rounded-xl bg-surface px-3 py-2 text-[12px] shadow-[var(--shadow-float)] ring-1 ring-line"
              style={{ left: `${Math.min(88, Math.max(12, ((hover + 0.5) / buckets.length) * 100))}%` }}
            >
              <p className="text-muted">{buckets[hover].title}</p>
              <p className="text-[15px] font-semibold text-ink">
                {plural(buckets[hover].values.reduce((a, v) => a + v, 0), "chat")}
              </p>
              {series.length > 1 &&
                series.map((s, k) => (
                  <p key={s.id} className="mt-0.5 flex items-center gap-2 text-ink-soft">
                    <span className="h-[2px] w-3 rounded-full" style={{ background: s.color }} />
                    <span className="font-semibold tabular-nums text-ink">{buckets[hover].values[k]}</span>
                    <span className="truncate">{s.label}</span>
                  </p>
                ))}
            </div>
          )}
        </div>
        <div className="relative mt-1.5 h-4 text-[11px] text-faint">
          {buckets.map((b, i) =>
            i % every === 0 ? (
              <span
                key={b.key}
                className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${((i + 0.5) / buckets.length) * 100}%` }}
              >
                {b.axis}
              </span>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}

/** Ranked bars with the value at the tip. */
function Ranked({ rows, empty }: { rows: { key: string; label: React.ReactNode; title: string; n: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <p className="mt-4 text-[14px] text-muted">{empty}</p>;
  return (
    <ul className="mt-4 space-y-3">
      {rows.map((r) => (
        <li key={r.key} title={r.title}>
          <div className="truncate text-[13px] text-ink-soft">{r.label}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-3 rounded-r-[4px]" style={{ width: `${(r.n / max) * 85}%`, minWidth: 3, background: "var(--color-series-1)" }} />
            <span className="text-[12px] font-semibold tabular-nums text-ink">{r.n.toLocaleString()}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Stat({ label: text, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={card}>
      <p className="text-[12px] font-medium text-muted">{text}</p>
      <p className="mt-1 text-[26px] font-semibold leading-tight text-ink">{value}</p>
      {note && <p className="mt-0.5 text-[12px] text-faint">{note}</p>}
    </div>
  );
}

/** How the chat is used: volume, where and when chats start, and how quickly Michael replies. */
export function Activity() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    devApi<Data>(`activity?days=${days}`).then(({ ok, data }) => {
      if (!live) return;
      setLoading(false);
      if (ok) setData(data);
    });
    return () => {
      live = false;
    };
  }, [days]);

  const buckets = useMemo<Bucket[]>(() => {
    if (!data) return [];
    const counts = new Map<string, number[]>();
    for (const r of data.perDay) {
      const v = counts.get(r.day) ?? [0, 0];
      v[SERIES.findIndex((s) => s.id === r.site)] += r.n;
      counts.set(r.day, v);
    }
    const end = todayET();
    const first = shift(end, -(data.days - 1));
    if (data.days <= 90) {
      return Array.from({ length: data.days }, (_, i) => {
        const day = shift(first, i);
        return { key: day, title: label(day, true), axis: label(day), values: counts.get(day) ?? [0, 0] };
      });
    }
    // A year reads better by week (weeks start on Monday).
    const weeks: Bucket[] = [];
    let day = first;
    const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
    day = shift(day, -((dow + 6) % 7));
    while (day <= end) {
      const values = [0, 0];
      for (let i = 0; i < 7; i++) {
        const v = counts.get(shift(day, i));
        if (v) {
          values[0] += v[0];
          values[1] += v[1];
        }
      }
      weeks.push({ key: day, title: `Week of ${label(day, true)}`, axis: label(day), values });
      day = shift(day, 7);
    }
    return weeks;
  }, [data]);

  const hours = useMemo<Bucket[]>(() => {
    const by = new Map((data?.hours ?? []).map((h) => [h.hour, h.n]));
    const name = (h: number) => (h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`);
    return Array.from({ length: 24 }, (_, h) => ({ key: String(h), title: `${name(h)} to ${name((h + 1) % 24)} ET`, axis: name(h), values: [by.get(h) ?? 0] }));
  }, [data]);

  const t = data?.totals;
  const r = data?.reply;
  const siteTotals = SERIES.map((_, k) => buckets.reduce((a, b) => a + b.values[k], 0));

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Period" className="inline-grid grid-cols-3 rounded-xl bg-surface p-1 shadow-[var(--shadow-bubble)]">
        {[30, 90, 365].map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={days === d}
            onClick={() => setDays(d)}
            className={`press rounded-[9px] px-4 py-1.5 text-[13px] font-medium ${days === d ? "bg-navy text-white" : "text-muted hover:text-ink"}`}
          >
            {d === 365 ? "12 months" : `${d} days`}
          </button>
        ))}
      </div>

      <div className={`space-y-4 transition-opacity ${loading && data ? "opacity-60" : ""}`}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Chats" value={t ? t.chats.toLocaleString() : "…"} note={t ? plural(t.people, "person", "people") : undefined} />
          <Stat label="Left an email" value={t ? pct(t.with_email, t.chats) : "…"} note={t ? plural(t.with_email, "chat") : undefined} />
          <Stat label="Left a phone number" value={t ? pct(t.with_phone, t.chats) : "…"} note={t ? plural(t.with_phone, "chat") : undefined} />
          <Stat label="Started while away" value={t ? pct(t.while_away, t.chats) : "…"} note={t ? plural(t.while_away, "chat") : undefined} />
          <Stat label="Typical first reply" value={r ? duration(r.median_seconds) : "…"} note="Median, from the first message" />
          <Stat
            label="Answered within 5 min"
            value={r ? pct(r.within_five, r.chats) : "…"}
            note={r ? `${r.chats - r.answered} not answered yet` : undefined}
          />
        </div>

        <section className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className={h2}>{days === 365 ? "Chats per week" : "Chats per day"}</h2>
              <p className={sub}>By the site the chat started on. Eastern time.</p>
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-soft">
              {SERIES.map((s, k) => (
                <li key={s.id} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
                  {s.label}
                  <span className="font-semibold tabular-nums text-ink">{siteTotals[k].toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
          {data && <Columns buckets={buckets} series={SERIES} />}
          {data && (
            <details className="mt-3 text-[13px]">
              <summary className="cursor-pointer text-muted hover:text-ink">View as table</summary>
              <div className="scroll-thin mt-2 max-h-64 overflow-y-auto">
                <table className="w-full text-left tabular-nums">
                  <thead className="text-[11px] uppercase tracking-[0.06em] text-muted">
                    <tr>
                      <th className="py-1 font-semibold">{days === 365 ? "Week of" : "Day"}</th>
                      {SERIES.map((s) => (
                        <th key={s.id} className="py-1 text-right font-semibold">
                          {s.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...buckets].reverse().map((b) => (
                      <tr key={b.key} className="border-t border-line text-ink-soft">
                        <td className="py-1">{b.title.replace("Week of ", "")}</td>
                        {b.values.map((v, k) => (
                          <td key={k} className="py-1 text-right">
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className={card}>
            <h2 className={h2}>Pages chats started on</h2>
            <p className={sub}>The ten most common. Town pages are marked.</p>
            {data && (
              <Ranked
                empty="No chats in this period."
                rows={data.pages.map((p) => ({
                  key: p.url,
                  title: p.url,
                  n: p.n,
                  label: (
                    <>
                      {p.town && (
                        <span className="mr-1.5 rounded-md bg-navy-tint px-1.5 py-0.5 text-[11px] font-medium text-accent">{p.town}</span>
                      )}
                      {p.title || p.url}
                    </>
                  ),
                }))}
              />
            )}
          </section>
          <section className={card}>
            <h2 className={h2}>Where visitors are</h2>
            <p className={sub}>From their IP address, so approximate.</p>
            {data && (
              <Ranked
                empty="No chats in this period."
                rows={data.places.map((p) => ({ key: p.place, title: p.place, n: p.n, label: p.place }))}
              />
            )}
          </section>
        </div>

        <section className={card}>
          <h2 className={h2}>Time of day</h2>
          <p className={sub}>When chats start, Eastern time.</p>
          {data && <Columns buckets={hours} series={[{ ...SERIES[0], label: "Chats" }]} height={140} />}
        </section>
      </div>
    </div>
  );
}
