"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sites } from "@/lib/sites";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  AutoThemeIcon,
  BackIcon,
  BellIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  CloseIcon,
  LogoutIcon,
  MailIcon,
  MoonIcon,
  MuteIcon,
  PlayIcon,
  PlusIcon,
  SpeakerIcon,
  Spinner,
  SunIcon,
  TrashIcon,
} from "../ui/icons";
import { Switch } from "../ui/Switch";
import { usePresence } from "./AdminShell";
import { getTheme, getTone, getVolume, setTheme, setTone, setVolume, type Theme } from "./prefs";
import { playTone, SILENT, toneFile, TONES } from "./tones";
import { adminApi } from "./util";

type FieldType = "text" | "email" | "tel" | "textarea" | "select" | "checkbox";
interface Field {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
  sites: string[];
  active: boolean;
}

const TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Short answer" },
  { value: "textarea", label: "Long answer" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Phone" },
  { value: "select", label: "Choice list" },
  { value: "checkbox", label: "Checkbox" },
];

const card = "rounded-2xl bg-surface p-4 shadow-[var(--shadow-bubble)] sm:p-5";
const h2 = "text-[17px] font-semibold";
const secondary =
  "press inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[14px] font-medium text-ink-soft hover:border-ink-soft/40 disabled:opacity-50";
const primary =
  "press inline-flex items-center justify-center gap-2 rounded-full bg-navy px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_2px_8px_rgba(0,35,73,0.25)] hover:bg-navy-light disabled:opacity-50 disabled:shadow-none";
const input =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] outline-none transition-[border-color,box-shadow] focus:border-navy/50 focus:shadow-[0_0_0_3px_rgba(0,35,73,0.08)]";

export function Settings({ appUrl }: { appUrl: string }) {
  return (
    <div className="anim-screen flex min-h-0 flex-1 flex-col bg-canvas">
      <header className="on-navy flex items-center gap-2 bg-chrome px-2 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] text-white sm:px-4">
        <Link href="/chatapp" aria-label="Back to chats" className="press rounded-full p-2 hover:bg-white/10 lg:hidden">
          <BackIcon className="h-6 w-6" />
        </Link>
        <h1 className="flex h-11 items-center px-1 text-[19px] font-semibold">Settings</h1>
      </header>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-5 pb-28">
          <Availability />
          <Appearance />
          <Notifications />
          <LeadEmails />
          <Sounds />
          <Questions />
          <Install appUrl={appUrl} />
          <SignOut />
        </div>
      </div>
    </div>
  );
}

function Availability() {
  const { online, setOnline } = usePresence();
  return (
    <section className={card}>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <h2 className={h2}>Available for chat</h2>
          <p className="mt-1 text-[14px] text-muted">
            {online === false
              ? "Away. Visitors are told you have their message and will follow up with them."
              : "Online. Visitors see that you're here and can chat with you live."}
          </p>
        </div>
        <Switch
          checked={online === true}
          disabled={online === null}
          onChange={(next) => setOnline(next)}
          label="Available for chat"
        />
      </div>
    </section>
  );
}

function Appearance() {
  const [theme, setThemeState] = useState<Theme>("light");
  useEffect(() => setThemeState(getTheme()), []);
  const choose = (t: Theme) => {
    setTheme(t);
    setThemeState(t);
  };
  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Light", icon: <SunIcon /> },
    { value: "dark", label: "Dark", icon: <MoonIcon /> },
    { value: "system", label: "Automatic", icon: <AutoThemeIcon /> },
  ];
  return (
    <section className={card}>
      <h2 className={h2}>Appearance</h2>
      <p className="mt-1 text-[14px] text-muted">
        Automatic follows your phone or computer. This is saved on this device only.
      </p>
      <div role="radiogroup" aria-label="Appearance" className="mt-3 grid grid-cols-3 gap-2">
        {options.map((o) => {
          const on = theme === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(o.value)}
              className={`press flex flex-col items-center gap-1.5 rounded-xl border py-3 text-[13px] font-medium ${
                on ? "border-navy bg-navy-tint text-accent" : "border-line text-ink-soft hover:border-ink-soft/40"
              }`}
            >
              {o.icon}
              {o.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Sounds() {
  const [tone, setToneState] = useState("bell");
  const [volume, setVolumeState] = useState(0.7);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setToneState(getTone());
    setVolumeState(getVolume());
  }, []);

  const choose = (id: string) => {
    setTone(id);
    setToneState(id);
    if (id !== SILENT) playTone(id, volume);
  };

  const current = TONES.find((t) => t.id === tone);

  const save = async () => {
    if (!current) return;
    setSaving(true);
    const blob = await toneFile(current.id);
    setSaving(false);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `MW Chat - ${current.name}.wav`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <section className={card}>
      <h2 className={h2}>Sounds</h2>
      <p className="mt-1 text-[14px] text-muted">
        Plays when a chat starts or a visitor writes while the app is open. Tap a tone to hear it.
      </p>

      <div role="radiogroup" aria-label="Notification tone" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[{ id: SILENT, name: "Silent" }, ...TONES].map((t) => {
          const on = tone === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(t.id)}
              className={`press flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[14px] font-medium ${
                on ? "border-navy bg-navy-tint text-accent" : "border-line text-ink-soft hover:border-ink-soft/40"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  on ? "bg-navy text-white" : "bg-canvas text-muted"
                }`}
              >
                {t.id === SILENT ? (
                  <MuteIcon className="h-4 w-4" />
                ) : on ? (
                  <CheckIcon className="h-4 w-4" strokeWidth={2.2} />
                ) : (
                  <PlayIcon className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="truncate">{t.name}</span>
            </button>
          );
        })}
      </div>

      <label className="mt-4 flex items-center gap-3">
        <SpeakerIcon className="h-5 w-5 shrink-0 text-muted" />
        <span className="sr-only">Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          disabled={tone === SILENT}
          onChange={(e) => {
            const v = Number(e.target.value);
            setVolumeState(v);
            setVolume(v);
          }}
          onPointerUp={() => tone !== SILENT && playTone(tone, volume)}
          onKeyUp={() => tone !== SILENT && playTone(tone, volume)}
          className="h-2 flex-1 cursor-pointer accent-[var(--color-navy)] disabled:opacity-40"
        />
        <span className="w-10 text-right text-[13px] tabular-nums text-muted">{Math.round(volume * 100)}%</span>
      </label>

      <div className="mt-4 rounded-xl bg-canvas p-3.5 text-[13px] leading-relaxed text-muted">
        When the app is closed, your phone plays the sound chosen for MW Chat in its own notification settings.
        To use this tone there too, save it, then choose it under Settings, Apps, MW Chat, Notifications, Sound.
        {current && (
          <button type="button" onClick={save} disabled={saving} className={`${secondary} mt-3 w-full justify-center sm:w-auto`}>
            {saving ? <Spinner /> : <DownloadIcon className="h-4 w-4" />} Save &ldquo;{current.name}&rdquo; to this device
          </button>
        )}
      </div>
    </section>
  );
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function Notifications() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [state, setState] = useState<"unsupported" | "off" | "on" | "blocked" | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await adminApi<{ push: { publicKey: string | null } }>("/api/admin/settings");
      setPublicKey(data.push?.publicKey ?? null);
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("blocked");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/chatapp" });
      setState((await reg.pushManager.getSubscription()) ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const turnOn = async () => {
    if (!publicKey) return;
    setBusy(true);
    setNote(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/chatapp" });
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(publicKey) });
      const { ok } = await adminApi("/api/admin/push", "POST", { subscription: sub.toJSON() });
      setState(ok ? "on" : "off");
      if (!ok) setNote("Could not save this device. Try again.");
    } catch {
      setNote("Notifications could not be turned on here.");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    const reg = await navigator.serviceWorker.getRegistration("/chatapp");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await adminApi("/api/admin/push", "DELETE", { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    setState("off");
    setBusy(false);
  };

  const test = async () => {
    setNote(null);
    const { ok } = await adminApi("/api/admin/push/test", "POST", {});
    setNote(ok ? "Sent. It should arrive in a few seconds." : "The test could not be sent.");
  };

  return (
    <section className={card}>
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-tint text-accent">
          <BellIcon />
        </span>
        <div className="flex-1">
          <h2 className={h2}>Notifications</h2>
          <p className="mt-1 text-[14px] text-muted">
            An alert on this device when a visitor starts a chat or writes while you&rsquo;re not looking at it.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {state === "loading" && <Spinner className="h-5 w-5 text-faint" />}
            {state === "off" && (
              <button type="button" className={primary} onClick={turnOn} disabled={busy || !publicKey}>
                {busy && <Spinner />} Turn on for this device
              </button>
            )}
            {state === "on" && (
              <>
                <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-ok">
                  <CheckIcon className="h-4 w-4" strokeWidth={2.2} /> On for this device
                </span>
                <button type="button" className={secondary} onClick={test}>
                  Send a test
                </button>
                <button type="button" className={secondary} onClick={turnOff} disabled={busy}>
                  Turn off
                </button>
              </>
            )}
            {state === "blocked" && (
              <p className="text-[14px] text-warn">
                Notifications are blocked for this app. Allow them in your phone or browser settings, then reopen the app.
              </p>
            )}
            {state === "unsupported" && (
              <p className="text-[14px] text-warn">
                This browser can&rsquo;t receive notifications. On a phone, use the installed app.
              </p>
            )}
          </div>
          {note && <p className="mt-2 text-[13px] text-muted">{note}</p>}
        </div>
      </div>
    </section>
  );
}

interface EmailSettings {
  configured: boolean;
  from: string;
  recipients: string[];
  mode: "every" | "away";
  max: number;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LeadEmails() {
  const [email, setEmail] = useState<EmailSettings | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    adminApi<{ email: EmailSettings }>("/api/admin/settings").then(({ ok, data }) => ok && setEmail(data.email));
  }, []);

  if (!email) {
    return (
      <section className={card} aria-busy>
        <span className="skeleton block h-5 w-32" />
        <span className="skeleton mt-4 block h-16 w-full !rounded-xl" />
      </section>
    );
  }

  const save = async (patch: { leadEmails?: string[]; leadEmailMode?: "every" | "away" }, done?: string) => {
    setBusy(true);
    setNote(null);
    const { ok, data } = await adminApi<{ email: EmailSettings; message?: string }>("/api/admin/settings", "PUT", patch);
    setBusy(false);
    if (ok) {
      setEmail(data.email);
      if (done) setNote({ ok: true, text: done });
    } else {
      setNote({ ok: false, text: data.message ?? "Could not save. Try again." });
    }
    return ok;
  };

  const add = async () => {
    const value = draft.trim().toLowerCase();
    if (!value) return;
    if (!EMAIL.test(value)) {
      setNote({ ok: false, text: "That doesn't look like an email address." });
      return;
    }
    if (email.recipients.includes(value)) {
      setDraft("");
      return;
    }
    if (await save({ leadEmails: [...email.recipients, value] }, `Added ${value}.`)) setDraft("");
  };

  const test = async () => {
    setTesting(true);
    setNote(null);
    const { ok, data } = await adminApi<{ to?: string[]; message?: string }>("/api/admin/email/test", "POST", {});
    setTesting(false);
    setNote(
      ok
        ? { ok: true, text: `Sent to ${(data.to ?? []).join(", ")}. It should arrive within a minute; check spam if it doesn't.` }
        : { ok: false, text: `Not sent: ${data.message ?? "the email service did not answer."}` },
    );
  };

  const full = email.recipients.length >= email.max;

  return (
    <section className={card}>
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-tint text-accent">
          <MailIcon />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={h2}>Lead emails</h2>
          <p className="mt-1 text-[14px] text-muted">
            Each new chat is emailed here with the visitor&rsquo;s answers, first message, the page they started on, location and
            IP address. Reply to the email to write to the visitor directly.
          </p>
        </div>
      </div>

      {!email.configured && (
        <p className="mt-3 rounded-xl bg-canvas p-3 text-[13px] text-warn">
          Email sending is not set up on the server yet: RESEND_API_KEY is missing in Vercel.
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {email.recipients.map((r) => (
          <li key={r} className="anim-rise flex items-center gap-2 rounded-xl border border-line bg-paper py-1.5 pl-3.5 pr-1.5">
            <span className="min-w-0 flex-1 truncate text-[15px]">{r}</span>
            <button
              type="button"
              aria-label={`Remove ${r}`}
              disabled={busy}
              onClick={() => save({ leadEmails: email.recipients.filter((x) => x !== r) }, `Removed ${r}.`)}
              className="press rounded-full p-2 text-muted hover:bg-surface hover:text-danger disabled:opacity-40"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </li>
        ))}
        {email.recipients.length === 0 && (
          <li className="rounded-xl bg-canvas p-3 text-[14px] text-muted">No addresses yet. Lead emails are off until you add one.</li>
        )}
      </ul>

      {!full && (
        <form
          noValidate
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Email address</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={draft}
              maxLength={254}
              placeholder="Add an email address"
              onChange={(e) => setDraft(e.target.value)}
              className={input}
            />
          </label>
          <button type="submit" className={secondary} disabled={busy || !draft.trim()}>
            {busy ? <Spinner /> : <PlusIcon className="h-4 w-4" />} Add
          </button>
        </form>
      )}

      <div className="mt-4 flex items-center gap-4 border-t border-line pt-4">
        <div className="flex-1">
          <p className="text-[15px] font-medium">Email every new lead</p>
          <p className="mt-0.5 text-[13px] text-muted">
            {email.mode === "every" ? "On. Every new chat is emailed, online or away." : "Off. Only chats that start while you're away are emailed."}
          </p>
        </div>
        <Switch
          checked={email.mode === "every"}
          disabled={busy}
          onChange={(on) => save({ leadEmailMode: on ? "every" : "away" })}
          label="Email every new lead"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <button type="button" className={secondary} onClick={test} disabled={testing || email.recipients.length === 0 || !email.configured}>
          {testing ? <Spinner /> : <MailIcon className="h-4 w-4" />} Send a test email
        </button>
        <span className="min-w-0 break-all text-[12px] text-faint">From {email.from.replace(/^.*<(.+)>$/, "$1")}</span>
      </div>
      {note && <p className={`anim-fade mt-3 break-words text-[14px] ${note.ok ? "text-ok" : "text-danger"}`}>{note.text}</p>}
    </section>
  );
}

function slug(label: string, taken: string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 30) || "question";
  const start = /^[a-z]/.test(base) ? base : `q_${base}`;
  let key = start;
  for (let i = 2; taken.includes(key); i++) key = `${start.slice(0, 27)}_${i}`;
  return key;
}

function Questions() {
  const [fields, setFields] = useState<Field[] | null>(null);
  const [saved, setSaved] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi<{ fields: Field[] }>("/api/admin/fields").then(({ ok, data }) => {
      if (!ok) return;
      setFields(data.fields);
      setSaved(JSON.stringify(data.fields));
    });
  }, []);

  if (!fields) {
    return (
      <section className={card} aria-busy>
        <span className="skeleton block h-5 w-40" />
        <span className="skeleton mt-4 block h-24 w-full !rounded-xl" />
      </section>
    );
  }
  const dirty = JSON.stringify(fields) !== saved;

  const update = (i: number, patch: Partial<Field>) => setFields((fs) => fs!.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, by: number) =>
    setFields((fs) => {
      const next = [...fs!];
      const j = i + by;
      if (j < 0 || j >= next.length) return next;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = async () => {
    setBusy(true);
    setMessage(null);
    const taken = fields.map((f) => f.key).filter(Boolean);
    const payload = fields.map((f) => {
      if (f.key) return f;
      const key = slug(f.label, taken);
      taken.push(key);
      return { ...f, key };
    });
    const { ok, data } = await adminApi<{ fields: Field[]; message?: string }>("/api/admin/fields", "PUT", { fields: payload });
    setBusy(false);
    if (ok) {
      setFields(data.fields);
      setSaved(JSON.stringify(data.fields));
      setMessage({ ok: true, text: "Saved. Visitors see these questions from their next chat." });
    } else {
      setMessage({ ok: false, text: data.message ?? "Could not save. Check each question and try again." });
    }
  };

  return (
    <section className={card}>
      <h2 className={h2}>Pre-chat questions</h2>
      <p className="mt-1 text-[14px] text-muted">
        What visitors answer before a chat starts, in this order. Every chat also asks for a first message. Questions with the
        keys <strong>name</strong>, <strong>email</strong> and <strong>phone</strong> fill in the visitor&rsquo;s contact details.
      </p>

      <ol className="mt-4 space-y-3">
        {fields.map((f, i) => (
          <li
            key={f.key || `new-${i}`}
            className={`anim-rise rounded-xl border border-line bg-paper p-3.5 transition-opacity ${f.active ? "" : "opacity-60"}`}
          >
            <div className="flex items-center gap-1 text-[12px] text-muted">
              <span className="font-semibold uppercase tracking-[0.06em]">Question {i + 1}</span>
              {f.key && <span className="min-w-0 truncate">· {f.key}</span>}
              <span className="ml-auto flex shrink-0">
                <button type="button" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0} className="press rounded-full p-1.5 hover:bg-surface disabled:opacity-30">
                  <ArrowUpIcon className="h-4 w-4" />
                </button>
                <button type="button" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === fields.length - 1} className="press rounded-full p-1.5 hover:bg-surface disabled:opacity-30">
                  <ArrowDownIcon className="h-4 w-4" />
                </button>
                <button type="button" aria-label="Remove question" onClick={() => setFields((fs) => fs!.filter((_, j) => j !== i))} className="press rounded-full p-1.5 text-danger hover:bg-surface">
                  <TrashIcon className="h-4 w-4" />
                </button>
              </span>
            </div>

            <label className="mt-2 block">
              <span className="sr-only">Question</span>
              <textarea
                rows={f.type === "checkbox" ? 3 : 1}
                value={f.label}
                maxLength={600}
                placeholder="Question"
                onChange={(e) => update(i, { label: e.target.value })}
                className={`${input} resize-y`}
              />
            </label>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2.5">
              <label className="flex items-center gap-2 text-[13px] text-ink-soft">
                Answer
                <select value={f.type} onChange={(e) => update(i, { type: e.target.value as FieldType })} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-[14px] outline-none focus:border-navy/50">
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <span className="flex items-center gap-2 text-[13px] text-ink-soft">
                <Switch checked={f.required} onChange={(v) => update(i, { required: v })} label="Required" />
                Required
              </span>
              <span className="flex items-center gap-2 text-[13px] text-ink-soft">
                <Switch checked={f.active} onChange={(v) => update(i, { active: v })} label="Shown" />
                Shown
              </span>
            </div>

            {f.type === "select" && (
              <label className="mt-2.5 block text-[13px] text-ink-soft">
                Choices, one per line
                <textarea
                  rows={Math.max(3, f.options.length)}
                  value={f.options.join("\n")}
                  onChange={(e) => update(i, { options: e.target.value.split("\n") })}
                  className={`${input} mt-1`}
                />
              </label>
            )}

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[13px] text-ink-soft">Ask on</span>
              {Object.values(sites).map((s) => {
                const on = f.sites.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update(i, { sites: on ? f.sites.filter((x) => x !== s.id) : [...f.sites, s.id] })}
                    className={`press inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-medium ${
                      on ? "border-navy bg-navy text-white" : "border-line bg-surface text-muted"
                    }`}
                  >
                    {on && <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.2} />}
                    {s.domain}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      <button
        type="button"
        className={`${secondary} mt-4`}
        onClick={() =>
          setFields((fs) => [
            ...fs!,
            { key: "", label: "", type: "text", required: false, options: [], sites: Object.keys(sites), active: true },
          ])
        }
      >
        <PlusIcon className="h-4 w-4" /> Add a question
      </button>
      {message && !dirty && (
        <p className={`anim-fade mt-3 text-[14px] ${message.ok ? "text-ok" : "text-danger"}`}>{message.text}</p>
      )}

      {dirty && (
        <div className="anim-rise fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:left-[380px]">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <p className="flex-1 text-[14px] text-ink-soft">
              {message && !message.ok ? <span className="text-danger">{message.text}</span> : "You have unsaved changes."}
            </p>
            <button type="button" className={secondary} onClick={() => setFields(JSON.parse(saved))}>
              Discard
            </button>
            <button type="button" className={primary} onClick={save} disabled={busy}>
              {busy && <Spinner />} Save
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Install({ appUrl }: { appUrl: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <section className={card}>
      <h2 className={h2}>On the websites</h2>
      <p className="mt-1 text-[14px] text-muted">Each site loads the chat with one line of code.</p>
      {Object.values(sites).map((s) => {
        const code = `<script src="${appUrl}/widget.js" data-site="${s.id}" async></script>`;
        return (
          <div key={s.id} className="mt-3">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-ink-soft">{s.domain}</p>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard?.writeText(code).catch(() => {});
                  setCopied(s.id);
                  setTimeout(() => setCopied(null), 1600);
                }}
                className="press inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium text-accent hover:bg-navy-tint"
              >
                {copied === s.id ? <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.2} /> : <CopyIcon className="h-3.5 w-3.5" />}
                {copied === s.id ? "Copied" : "Copy"}
              </button>
            </div>
            <code className="scroll-thin mt-1 block overflow-x-auto whitespace-pre rounded-xl bg-canvas p-3 text-[12px] text-ink-soft">{code}</code>
          </div>
        );
      })}
    </section>
  );
}

function SignOut() {
  return (
    <section className={card}>
      <button
        type="button"
        className="press flex w-full items-center gap-3 text-left text-[15px] font-medium text-danger"
        onClick={async () => {
          await adminApi("/api/admin/logout", "POST", {});
          window.location.href = "/chatapp/login";
        }}
      >
        <LogoutIcon /> Sign out of this device
      </button>
    </section>
  );
}
