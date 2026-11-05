"use client";

import { useEffect, useState } from "react";
import { DownloadIcon, SearchIcon, Spinner, TrashIcon } from "../ui/icons";
import { bytes, card, danger, devApi, h2, input, plural, secondary, sub, when } from "./api";

interface Person {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  last_seen_at: string;
  chats: number;
  messages: number;
  files: number;
}

/** A dialog that asks for the word DELETE before anything is removed. */
function Confirm({
  title,
  body,
  action,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: React.ReactNode;
  action: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);
  return (
    <div className="anim-fade fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && onCancel()}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="anim-pop w-full max-w-md rounded-2xl bg-surface p-5 shadow-[var(--shadow-float)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[17px] font-semibold text-ink">{title}</h3>
        <div className="mt-2 text-[14px] leading-relaxed text-ink-soft">{body}</div>
        <label className="mt-4 block text-[13px] text-muted">
          Type DELETE to confirm
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus className={`${input} mt-1 w-full`} />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={secondary} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={danger}
            disabled={typed.trim() !== "DELETE" || busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              setBusy(false);
            }}
          >
            {busy && <Spinner />} {action}
          </button>
        </div>
      </div>
    </div>
  );
}

function People() {
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [target, setTarget] = useState<Person | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setPeople(null);
      return;
    }
    const t = setTimeout(async () => {
      const { ok, data } = await devApi<{ people: Person[] }>(`people?q=${encodeURIComponent(term)}`);
      if (ok) setPeople(data.people);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <section className={card}>
      <h2 className={h2}>Delete a person&rsquo;s data</h2>
      <p className={sub}>
        For a privacy request. Removes their chats, messages, photos and contact details from MW Chat. Lead emails already in your
        inbox are not affected.
      </p>
      <label className="relative mt-3 block max-w-md">
        <span className="sr-only">Find a person</span>
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-faint" />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setDone(null);
          }}
          placeholder="Name, email or phone"
          className={`${input} w-full pl-10`}
        />
      </label>
      {done && <p className="anim-fade mt-3 text-[14px] text-ok">{done}</p>}
      {people && (
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
          {people.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-3.5 py-3">
              <div className="min-w-0 flex-1 text-[13px]">
                <p className="font-medium text-ink">{p.name || "No name"}</p>
                <p className="truncate text-muted">{[p.email, p.phone].filter(Boolean).join(" · ") || "No contact details"}</p>
                <p className="text-faint">
                  {plural(p.chats, "chat")}, {plural(p.messages, "message")}, {plural(p.files, "file")} · first seen{" "}
                  {when(p.created_at, false)}
                </p>
              </div>
              <button type="button" className={`${secondary} !text-danger`} onClick={() => setTarget(p)}>
                <TrashIcon className="h-4 w-4" /> Delete
              </button>
            </li>
          ))}
          {people.length === 0 && <li className="px-3.5 py-4 text-[13px] text-muted">No one matches.</li>}
        </ul>
      )}
      {target && (
        <Confirm
          title={`Delete ${target.name || target.email || "this person"}?`}
          body={
            <>
              This permanently removes {plural(target.chats, "chat")}, {plural(target.messages, "message")} and{" "}
              {plural(target.files, "file")}. It cannot be undone.
            </>
          }
          action="Delete everything"
          onCancel={() => setTarget(null)}
          onConfirm={async () => {
            const { ok } = await devApi(`people/${target.id}`, "DELETE");
            setTarget(null);
            if (ok) {
              setPeople((list) => list?.filter((p) => p.id !== target.id) ?? null);
              setDone(`Deleted ${target.name || target.email || "that person"}'s data.`);
            } else {
              setDone(null);
            }
          }}
        />
      )}
    </section>
  );
}

function OldFiles() {
  const [months, setMonths] = useState(12);
  const [stats, setStats] = useState<{ count: number; bytes: number } | null>(null);
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    setStats(null);
    devApi<{ count: number; bytes: number }>(`attachments?months=${months}`).then(({ ok, data }) => ok && setStats(data));
  }, [months]);

  return (
    <section className={card}>
      <h2 className={h2}>Clear old photos and PDFs</h2>
      <p className={sub}>Frees space. The messages stay, marked &ldquo;Attachment removed&rdquo;.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[14px] text-ink">
          Older than
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className={`${input} pr-8`}>
            {[3, 6, 12, 24].map((m) => (
              <option key={m} value={m}>
                {m} months
              </option>
            ))}
          </select>
        </label>
        <p className="text-[14px] text-muted">
          {stats ? (stats.count ? `${plural(stats.count, "file")}, ${bytes(stats.bytes)}` : "Nothing that old") : "Counting…"}
        </p>
        <button type="button" className={`${secondary} !text-danger`} disabled={!stats?.count} onClick={() => setAsking(true)}>
          <TrashIcon className="h-4 w-4" /> Clear
        </button>
      </div>
      {done && <p className="anim-fade mt-3 text-[14px] text-ok">{done}</p>}
      {asking && stats && (
        <Confirm
          title={`Clear ${plural(stats.count, "old file")}?`}
          body={<>Photos and PDFs sent more than {months} months ago ({bytes(stats.bytes)}) will be deleted. This cannot be undone.</>}
          action="Clear files"
          onCancel={() => setAsking(false)}
          onConfirm={async () => {
            const { ok, data } = await devApi<{ count: number; bytes: number }>("attachments", "POST", { months });
            setAsking(false);
            if (ok) {
              setDone(`Cleared ${plural(data.count, "file")}, ${bytes(data.bytes)}.`);
              setStats({ count: 0, bytes: 0 });
            }
          }}
        />
      )}
    </section>
  );
}

/** Privacy requests, space, and a copy of everything. */
export function DataTools() {
  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className={h2}>Download</h2>
        <p className={sub}>
          A backup has every person, chat, message, question and setting as one JSON file. Photos are listed but not included, and
          the app&rsquo;s private keys are left out.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/developer/api/backup" className={secondary} download>
            <DownloadIcon className="h-4 w-4" /> Full backup (JSON)
          </a>
          <a href="/developer/api/leads/export" className={secondary} download>
            <DownloadIcon className="h-4 w-4" /> All leads (CSV)
          </a>
        </div>
      </section>
      <People />
      <OldFiles />
    </div>
  );
}
