"use client";

import { useEffect, useState } from "react";
import { sites } from "@/lib/sites";
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

const card = "rounded-sm border border-line bg-white p-4";
const h2 = "font-display text-[18px]";
const button =
  "rounded-sm border border-line px-3 py-2 text-[13px] text-ink-soft hover:border-ink-soft disabled:opacity-50";
const primary =
  "rounded-sm bg-navy px-4 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] text-white disabled:opacity-50";

export function Settings({ appUrl }: { appUrl: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
      <Notifications />
      <Questions />
      <Install appUrl={appUrl} />
      <SignOut />
    </div>
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
  const [publicKey, setPublicKey] = useState<string | null | undefined>(undefined);
  const [state, setState] = useState<"unsupported" | "off" | "on" | "blocked" | "loading">("loading");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await adminApi<{ push: { configured: boolean; publicKey: string | null } }>(
        "/api/admin/settings",
      );
      setPublicKey(data.push?.configured ? data.push.publicKey : null);
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("blocked");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/admin" });
      setState((await reg.pushManager.getSubscription()) ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const turnOn = async () => {
    if (!publicKey) return;
    setNote(null);
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setState(permission === "denied" ? "blocked" : "off");
      return;
    }
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/admin" });
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToBytes(publicKey),
    });
    const { ok } = await adminApi("/api/admin/push", "POST", { subscription: sub.toJSON() });
    setState(ok ? "on" : "off");
    if (!ok) setNote("Could not save this device. Try again.");
  };

  const turnOff = async () => {
    const reg = await navigator.serviceWorker.getRegistration("/admin");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await adminApi("/api/admin/push", "DELETE", { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    setState("off");
  };

  const test = async () => {
    setNote(null);
    const { ok } = await adminApi("/api/admin/push/test", "POST", {});
    setNote(ok ? "Sent. It should arrive within a few seconds." : "The test could not be sent.");
  };

  return (
    <section className={card}>
      <h2 className={h2}>Notifications</h2>
      <p className="mt-1 text-[13px] text-ink-soft">
        Get an alert on this device when a visitor starts a chat or writes while you are not looking at it.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {publicKey === null && (
          <p className="text-[13px] text-warn">Notifications are not set up on the server yet.</p>
        )}
        {publicKey && state === "off" && (
          <button type="button" className={primary} onClick={turnOn}>
            Turn on for this device
          </button>
        )}
        {publicKey && state === "on" && (
          <>
            <span className="text-[13px] text-ok">On for this device.</span>
            <button type="button" className={button} onClick={test}>
              Send a test
            </button>
            <button type="button" className={button} onClick={turnOff}>
              Turn off
            </button>
          </>
        )}
        {state === "blocked" && (
          <p className="text-[13px] text-warn">
            Notifications are blocked for this app. Allow them in your phone or browser settings, then reload.
          </p>
        )}
        {state === "unsupported" && (
          <p className="text-[13px] text-warn">
            This browser cannot receive notifications. On a phone, install the app to the home screen first.
          </p>
        )}
      </div>
      {note && <p className="mt-2 text-[12px] text-muted">{note}</p>}
    </section>
  );
}

function slug(label: string, taken: string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^(\d)/, "q_$1")
      .slice(0, 30) || "question";
  let key = /^[a-z]/.test(base) ? base : `q_${base}`;
  for (let i = 2; taken.includes(key); i++) key = `${base.slice(0, 27)}_${i}`;
  return key;
}

function Questions() {
  const [fields, setFields] = useState<Field[] | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi<{ fields: Field[] }>("/api/admin/fields").then(({ ok, data }) => {
      if (!ok) return;
      setFields(data.fields);
      setSaved(JSON.stringify(data.fields));
    });
  }, []);

  if (!fields) return <section className={card}>Loading questions…</section>;
  const dirty = JSON.stringify(fields) !== saved;

  const update = (i: number, patch: Partial<Field>) =>
    setFields((fs) => fs!.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, by: number) =>
    setFields((fs) => {
      const next = [...fs!];
      const j = i + by;
      if (j < 0 || j >= next.length) return next;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const remove = (i: number) => setFields((fs) => fs!.filter((_, j) => j !== i));
  const add = () =>
    setFields((fs) => [
      ...fs!,
      {
        key: "",
        label: "",
        type: "text",
        required: false,
        options: [],
        sites: Object.keys(sites),
        active: true,
      },
    ]);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    const taken: string[] = [];
    const payload = fields.map((f) => {
      const key = f.key || slug(f.label, [...taken, ...fields.map((g) => g.key)]);
      taken.push(key);
      return { ...f, key };
    });
    const { ok, data } = await adminApi<{ fields: Field[]; message?: string }>("/api/admin/fields", "PUT", {
      fields: payload,
    });
    setBusy(false);
    if (ok) {
      setFields(data.fields);
      setSaved(JSON.stringify(data.fields));
      setMessage({ ok: true, text: "Saved. Visitors see the new questions from their next chat." });
    } else {
      setMessage({ ok: false, text: data.message ?? "Could not save. Check each question and try again." });
    }
  };

  const input = "w-full rounded-sm border border-line bg-paper px-2.5 py-2 text-[14px] outline-none focus:border-navy";

  return (
    <section className={card}>
      <h2 className={h2}>Pre-chat questions</h2>
      <p className="mt-1 text-[13px] text-ink-soft">
        What visitors answer before a chat starts, in this order. Every chat also asks for a first message.
        Questions named <strong>name</strong>, <strong>email</strong> and <strong>phone</strong> fill in the
        visitor&rsquo;s contact details.
      </p>

      <ol className="mt-4 space-y-3">
        {fields.map((f, i) => (
          <li key={f.key || `new-${i}`} className={`rounded-sm border border-line p-3 ${f.active ? "" : "opacity-60"}`}>
            <div className="flex min-w-0 items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-muted">
              <span className="shrink-0">Question {i + 1}</span>
              {f.key && <span className="min-w-0 truncate normal-case tracking-normal">· {f.key}</span>}
              <span className="ml-auto flex shrink-0 gap-1">
                <button type="button" className="px-1.5" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                  ↑
                </button>
                <button
                  type="button"
                  className="px-1.5"
                  aria-label="Move down"
                  onClick={() => move(i, 1)}
                  disabled={i === fields.length - 1}
                >
                  ↓
                </button>
                <button type="button" className="px-1.5 text-danger" onClick={() => remove(i)}>
                  Remove
                </button>
              </span>
            </div>

            <label className="mt-2 block text-[12px] text-ink-soft">
              Question
              <textarea
                rows={f.type === "checkbox" ? 3 : 1}
                value={f.label}
                maxLength={600}
                onChange={(e) => update(i, { label: e.target.value })}
                className={`${input} mt-1 resize-y`}
              />
            </label>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="block text-[12px] text-ink-soft">
                Answer type
                <select
                  value={f.type}
                  onChange={(e) => update(i, { type: e.target.value as FieldType })}
                  className={`${input} mt-1`}
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap items-end gap-x-4 gap-y-1 pb-2 text-[13px]">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="accent-navy"
                    checked={f.required}
                    onChange={(e) => update(i, { required: e.target.checked })}
                  />
                  Required
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="accent-navy"
                    checked={f.active}
                    onChange={(e) => update(i, { active: e.target.checked })}
                  />
                  Shown
                </label>
              </div>
            </div>

            {f.type === "select" && (
              <label className="mt-2 block text-[12px] text-ink-soft">
                Choices, one per line
                <textarea
                  rows={Math.max(3, f.options.length)}
                  value={f.options.join("\n")}
                  onChange={(e) => update(i, { options: e.target.value.split("\n") })}
                  className={`${input} mt-1`}
                />
              </label>
            )}

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
              <span className="text-[12px] text-ink-soft">Ask on:</span>
              {Object.values(sites).map((s) => (
                <label key={s.id} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="accent-navy"
                    checked={f.sites.includes(s.id)}
                    onChange={(e) =>
                      update(i, {
                        sites: e.target.checked ? [...f.sites, s.id] : f.sites.filter((x) => x !== s.id),
                      })
                    }
                  />
                  {s.domain}
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className={button} onClick={add}>
          Add a question
        </button>
        <button type="button" className={`${primary} ml-auto`} onClick={save} disabled={!dirty || busy}>
          {busy ? "Saving…" : "Save questions"}
        </button>
      </div>
      {message && (
        <p className={`mt-2 text-[13px] ${message.ok ? "text-ok" : "text-danger"}`}>{message.text}</p>
      )}
    </section>
  );
}

function Install({ appUrl }: { appUrl: string }) {
  return (
    <section className={card}>
      <h2 className={h2}>On the websites</h2>
      <p className="mt-1 text-[13px] text-ink-soft">
        Each site loads the chat with one line. These go in on the sites&rsquo; chat-test branches first.
      </p>
      {Object.values(sites).map((s) => (
        <div key={s.id} className="mt-3">
          <p className="text-[12px] text-muted">{s.domain}</p>
          <code className="mt-1 block overflow-x-auto whitespace-pre rounded-sm bg-paper p-2.5 text-[12px]">
            {`<script src="${appUrl}/widget.js" data-site="${s.id}" async></script>`}
          </code>
        </div>
      ))}
    </section>
  );
}

function SignOut() {
  return (
    <section className={card}>
      <button
        type="button"
        className={button}
        onClick={async () => {
          await adminApi("/api/admin/logout", "POST", {});
          window.location.href = "/admin/login";
        }}
      >
        Sign out of this device
      </button>
    </section>
  );
}
