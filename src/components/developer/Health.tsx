"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertIcon, CheckIcon, Spinner } from "../ui/icons";
import { bytes, card, devApi, h2, secondary, sub, when } from "./api";

interface Data {
  database: { ok: boolean; ms: number; error?: string; value?: { version: string; bytes: number }; tables?: { name: string; bytes: number }[] };
  counts?: { visitors: number; chats: number; open_chats: number; messages: number; files: number; file_bytes: number };
  migrations?: { id: string; applied_at: string }[];
  email?: {
    configured: boolean;
    from: string;
    recipients: string[];
    mode: "every" | "away";
    failed30: number;
    sent30: number;
    recent: { id: number; kind: string; recipients: string[]; subject: string; ok: boolean; error: string | null; created_at: string }[];
  };
  push?: {
    keys: boolean;
    devices: number;
    sent24: number;
    failed24: number;
    recent: { id: number; title: string; service: string; status: number | null; ok: boolean; error: string | null; ms: number | null; created_at: string }[];
  };
  errors?: {
    last24h: number;
    recent: { id: number; source: string; message: string; detail: Record<string, unknown> | null; created_at: string }[];
  };
  online?: boolean;
  env?: { name: string; purpose: string; set: boolean }[];
  separateDevPassword?: boolean;
  version?: {
    commit: string | null;
    message: string | null;
    branch: string | null;
    builtAt: string | null;
    environment: string;
    region: string | null;
    node: string;
  };
}

type Level = "ok" | "warn" | "bad";

function Status({ level, title, value, note }: { level: Level; title: string; value: string; note?: string }) {
  const tone = level === "ok" ? "text-ok" : level === "warn" ? "text-warn" : "text-danger";
  return (
    <div className={card}>
      <p className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
        <span className={tone}>{level === "ok" ? <CheckIcon className="h-4 w-4" strokeWidth={2.2} /> : <AlertIcon className="h-4 w-4" />}</span>
        {title}
      </p>
      <p className={`mt-1 text-[18px] font-semibold leading-snug ${level === "ok" ? "text-ink" : tone}`}>{value}</p>
      {note && <p className="mt-0.5 text-[12px] text-faint">{note}</p>}
    </div>
  );
}

const KINDS: Record<string, string> = {
  lead: "Lead",
  test: "Test",
  rescue: "Still waiting",
  reply: "Reply to visitor",
};

const TABLE_NAMES: Record<string, string> = {
  attachments: "Photos and PDFs",
  messages: "Messages",
  conversations: "Chats",
  visitors: "Visitors",
  email_log: "Email log",
  error_log: "Error log",
  push_subscriptions: "Notification devices",
  prechat_fields: "Pre-chat questions",
  settings: "Settings",
  schema_migrations: "Database versions",
};

/** Is everything working: database, email, notifications, errors, storage, version. */
export function Health() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    const { data } = await devApi<Data>("health");
    setData(data);
    setCheckedAt(new Date());
    setBusy(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-busy>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={card}>
            <span className="skeleton block h-4 w-24" />
            <span className="skeleton mt-3 block h-6 w-32" />
          </div>
        ))}
      </div>
    );
  }

  const db = data.database;
  const e = data.email;
  const maxTable = Math.max(1, ...(db.tables ?? []).map((t) => t.bytes));

  return (
    <div className={`space-y-4 transition-opacity ${busy ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={secondary} onClick={load} disabled={busy}>
          {busy && <Spinner />} Check again
        </button>
        {checkedAt && <p className="text-[13px] text-muted">Checked {checkedAt.toLocaleTimeString("en-US", { timeStyle: "short" })}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Status
          level={db.ok ? (db.ms > 800 ? "warn" : "ok") : "bad"}
          title="Database"
          value={db.ok ? `Connected, ${db.ms} ms` : "Not reachable"}
          note={db.ok ? `Postgres ${db.value?.version}` : db.error}
        />
        {e && (
          <Status
            level={!e.configured || e.recipients.length === 0 ? "bad" : e.failed30 > 0 ? "warn" : "ok"}
            title="Lead emails"
            value={
              !e.configured
                ? "Not set up"
                : e.recipients.length === 0
                  ? "No addresses"
                  : e.failed30 > 0
                    ? `${e.failed30} failed`
                    : "Working"
            }
            note={e.configured ? `${e.sent30} sent in 30 days, ${e.mode === "every" ? "every lead" : "only while away"}` : "RESEND_API_KEY is missing"}
          />
        )}
        {data.push && (
          <Status
            level={!data.push.keys ? "bad" : data.push.devices === 0 || data.push.failed24 > 0 ? "warn" : "ok"}
            title="Notifications"
            value={data.push.devices === 1 ? "1 device" : `${data.push.devices} devices`}
            note={
              data.push.devices === 0
                ? "Turn on in the chat app's Settings"
                : `${data.push.sent24} sent, ${data.push.failed24} failed in 24 hours`
            }
          />
        )}
        {data.errors && (
          <Status
            level={data.errors.last24h === 0 ? "ok" : "warn"}
            title="Errors"
            value={data.errors.last24h === 0 ? "None today" : `${data.errors.last24h} in 24 hours`}
            note="Listed below"
          />
        )}
        <Status
          level="ok"
          title="Availability"
          value={data.online ? "Online" : "Away"}
          note="Set in the chat app"
        />
      </div>

      {db.ok && data.counts && (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <section className={card}>
            <h2 className={h2}>Storage</h2>
            <p className={sub}>
              The database uses {bytes(db.value!.bytes)} in all. Check your Supabase plan&rsquo;s limit in the Supabase dashboard.
            </p>
            <ul className="mt-4 space-y-2.5">
              {(db.tables ?? []).map((t) => (
                <li key={t.name} className="grid grid-cols-[150px_1fr_70px] items-center gap-3 text-[13px]">
                  <span className="truncate text-ink-soft">{TABLE_NAMES[t.name] ?? t.name}</span>
                  <span className="h-2.5 rounded-r-[4px]" style={{ width: `${Math.max(1, (t.bytes / maxTable) * 100)}%`, background: "var(--color-series-1)" }} />
                  <span className="text-right tabular-nums text-ink">{bytes(t.bytes)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className={card}>
            <h2 className={h2}>What&rsquo;s stored</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
              {[
                ["People", data.counts.visitors],
                ["Chats", data.counts.chats],
                ["Open chats", data.counts.open_chats],
                ["Messages", data.counts.messages],
                ["Photos and PDFs", data.counts.files],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-[18px] font-semibold text-ink">{(v as number).toLocaleString()}</dd>
                </div>
              ))}
              <div>
                <dt className="text-muted">Size of files</dt>
                <dd className="text-[18px] font-semibold text-ink">{bytes(data.counts.file_bytes)}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}

      {e && (
        <section className={`${card} !p-0`}>
          <div className="px-4 pb-3 pt-4 sm:px-5">
            <h2 className={h2}>Email log</h2>
            <p className={sub}>
              The last 15 emails, sent from {e.from.replace(/^.*<(.+)>$/, "$1")}. Lead emails go to{" "}
              {e.recipients.join(", ") || "no one yet"}.
            </p>
          </div>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="border-y border-line text-[11px] uppercase tracking-[0.06em] text-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold sm:pl-5">When</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">To</th>
                  <th className="px-3 py-2 font-semibold">Subject</th>
                  <th className="px-4 py-2 font-semibold sm:pr-5">Result</th>
                </tr>
              </thead>
              <tbody>
                {e.recent.map((m) => (
                  <tr key={m.id} className="border-b border-line align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted sm:pl-5">{when(m.created_at)}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{KINDS[m.kind] ?? m.kind}</td>
                    <td className="max-w-[220px] break-words px-3 py-2.5 text-ink-soft">{m.recipients.join(", ")}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{m.subject}</td>
                    <td className="px-4 py-2.5 sm:pr-5">
                      {m.ok ? (
                        <span className="inline-flex items-center gap-1 font-medium text-ok">
                          <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.2} /> Sent
                        </span>
                      ) : (
                        <span className="text-danger">
                          <span className="font-medium">Failed:</span> {m.error}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {e.recent.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-muted">
                      No emails yet. Use Send a test email in the chat app&rsquo;s Settings.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data.push && (
        <section className={`${card} !p-0`}>
          <div className="px-4 pb-3 pt-4 sm:px-5">
            <h2 className={h2}>Notification log</h2>
            <p className={sub}>
              The last 15 notifications and when the push service accepted them. If one shows here as sent on time but reached your
              phone late, the delay is on the phone: see Notifications in the chat app&rsquo;s Settings for what to change.
            </p>
          </div>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead className="border-y border-line text-[11px] uppercase tracking-[0.06em] text-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold sm:pl-5">Sent</th>
                  <th className="px-3 py-2 font-semibold">Notification</th>
                  <th className="px-3 py-2 font-semibold">Service</th>
                  <th className="px-4 py-2 font-semibold sm:pr-5">Result</th>
                </tr>
              </thead>
              <tbody>
                {data.push.recent.map((p) => (
                  <tr key={p.id} className="border-b border-line align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted sm:pl-5">{when(p.created_at)}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{p.title}</td>
                    <td className="px-3 py-2.5 text-muted">{p.service}</td>
                    <td className="px-4 py-2.5 sm:pr-5">
                      {p.ok ? (
                        <span className="font-medium text-ok">
                          Accepted{p.ms !== null ? ` in ${(p.ms / 1000).toFixed(1)}s` : ""}
                        </span>
                      ) : (
                        <span className="text-danger">
                          Failed{p.status ? ` (${p.status})` : ""}: {p.error}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {data.push.recent.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-muted">
                      None yet. Use Send a test under Notifications in the chat app&rsquo;s Settings.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data.errors && (
        <section className={`${card} !p-0`}>
          <div className="px-4 pb-3 pt-4 sm:px-5">
            <h2 className={h2}>Errors</h2>
            <p className={sub}>Anything that went wrong, newest first. Kept for 90 days.</p>
          </div>
          <ul className="border-t border-line">
            {data.errors.recent.map((x) => (
              <li key={x.id} className="border-b border-line px-4 py-3 text-[13px] last:border-0 sm:px-5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="rounded-md bg-canvas px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-soft">
                    {x.source}
                  </span>
                  <span className="text-muted">{when(x.created_at)}</span>
                  {typeof x.detail?.path === "string" && <code className="text-[12px] text-faint">{x.detail.method as string} {x.detail.path}</code>}
                </div>
                <p className="mt-1 break-words text-ink">{x.message}</p>
              </li>
            ))}
            {data.errors.recent.length === 0 && <li className="px-5 py-8 text-center text-[13px] text-muted">No errors recorded.</li>}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {data.version && (
          <section className={card}>
            <h2 className={h2}>Version</h2>
            <dl className="mt-3 space-y-2 text-[13px]">
              {[
                ["Running", data.version.environment === "production" ? "Production" : data.version.environment === "preview" ? "Preview" : "Local copy"],
                ["Change", data.version.commit ? `${data.version.commit} ${data.version.message ?? ""}` : "Not available"],
                ["Branch", data.version.branch ?? "Not available"],
                ["Built", data.version.builtAt ? when(data.version.builtAt) + " ET" : "Not available"],
                ["Server", [data.version.region, `Node ${data.version.node}`].filter(Boolean).join(", ")],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-4">
                  <dt className="w-20 shrink-0 text-muted">{k}</dt>
                  <dd className="min-w-0 break-words text-ink-soft">{v}</dd>
                </div>
              ))}
            </dl>
            {data.migrations && (
              <>
                <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Database versions</p>
                <ul className="mt-1.5 space-y-1 text-[13px]">
                  {data.migrations.map((m) => (
                    <li key={m.id} className="flex justify-between gap-3 text-ink-soft">
                      <code className="text-[12px]">{m.id}</code>
                      <span className="text-faint">{when(m.applied_at, false)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
        {data.env && (
          <section className={card}>
            <h2 className={h2}>Configuration</h2>
            <p className={sub}>Environment variables in Vercel. Only whether each is set is shown, never its value.</p>
            <ul className="mt-3 space-y-2.5 text-[13px]">
              {data.env.map((v) => (
                <li key={v.name} className="flex items-start gap-2.5">
                  <span className={`mt-0.5 ${v.set ? "text-ok" : "text-faint"}`}>
                    {v.set ? <CheckIcon className="h-4 w-4" strokeWidth={2.2} /> : <span className="block h-4 w-4 text-center leading-4">&ndash;</span>}
                  </span>
                  <span className="min-w-0">
                    <code className="text-[12px] font-semibold text-ink">{v.name}</code>
                    <span className="block text-muted">{v.purpose}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
