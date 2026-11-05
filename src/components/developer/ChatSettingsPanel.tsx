"use client";

import { useEffect, useState } from "react";
import { HEADSHOT_URL } from "@/lib/sites";
import { Spinner } from "../ui/icons";
import { Switch } from "../ui/Switch";
import { card, devApi, h2, input, primary, secondary, sub } from "./api";

interface Settings {
  greeting: { enabled: boolean; delay: number; lines: { general: string; town: string; horse: string; away: string } };
  awayMessage: string;
  visitorAttachments: boolean;
  visitorFilesPerChat: number;
  autoCloseDays: number;
  launcher: Record<string, boolean>;
}

const LINES: { key: keyof Settings["greeting"]["lines"]; label: string; hint: string }[] = [
  { key: "general", label: "Most pages", hint: "On westchesterguy.com pages other than a town page." },
  { key: "town", label: "Town pages", hint: "{town} becomes the town's name, as on /communities/bedford." },
  { key: "horse", label: "Horse site", hint: "Every page on westchesterhorseproperties.com." },
  { key: "away", label: "While you're away", hint: "On both sites when you're set to Away in the admin app." },
];

function Row({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 border-t border-line py-3.5 first:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-ink">{title}</p>
        {note && <p className="mt-0.5 text-[13px] text-muted">{note}</p>}
      </div>
      {children}
    </div>
  );
}

/** How the greeting looks on the sites, drawn from the line being edited. */
function GreetingPreview({ text }: { text: string }) {
  return (
    <div className="relative mt-3 w-full max-w-[292px] rounded-[18px] bg-white p-3.5 pr-10 text-[#17181a] shadow-[0_18px_48px_rgba(0,35,73,0.22),0_3px_10px_rgba(0,0,0,0.08)]">
      <div className="flex items-start gap-3">
        <span className="relative h-11 w-11 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={HEADSHOT_URL} alt="" className="h-11 w-11 rounded-full bg-[#002349] object-cover" />
          <span className="absolute bottom-px right-0 h-3 w-3 rounded-full border-2 border-white bg-[#23864f]" />
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-[#002349]">Michael Winter</span>
          <span className="mt-0.5 block text-[14.5px] leading-[1.45]">{text || " "}</span>
        </span>
      </div>
      <span className="absolute -bottom-1.5 right-6 h-3.5 w-3.5 rotate-45 rounded-br-[3px] bg-white" />
    </div>
  );
}

/** The chat's behaviour on the sites: greeting, away message, attachments, auto-close, chat button. */
export function ChatSettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [defaults, setDefaults] = useState<Settings | null>(null);
  const [sites, setSites] = useState<{ id: string; domain: string }[]>([]);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [previewLine, setPreviewLine] = useState<keyof Settings["greeting"]["lines"]>("town");

  useEffect(() => {
    devApi<{ settings: Settings; defaults: Settings; sites: { id: string; domain: string }[] }>("settings").then(({ ok, data }) => {
      if (!ok) return;
      setSettings(data.settings);
      setDefaults(data.defaults);
      setSites(data.sites);
      setSaved(JSON.stringify(data.settings));
    });
  }, []);

  if (!settings || !defaults) {
    return (
      <div className={card} aria-busy>
        <span className="skeleton block h-5 w-40" />
        <span className="skeleton mt-4 block h-32 w-full !rounded-xl" />
      </div>
    );
  }

  const dirty = JSON.stringify(settings) !== saved;
  const set = (patch: Partial<Settings>) => {
    setMessage(null);
    setSettings((s) => ({ ...s!, ...patch }));
  };
  const setGreeting = (patch: Partial<Settings["greeting"]>) => set({ greeting: { ...settings.greeting, ...patch } });
  const setLine = (key: keyof Settings["greeting"]["lines"], value: string) =>
    setGreeting({ lines: { ...settings.greeting.lines, [key]: value } });

  const save = async () => {
    setBusy(true);
    const { ok, data } = await devApi<{ settings: Settings; message?: string }>("settings", "PUT", { settings });
    setBusy(false);
    if (ok) {
      setSettings(data.settings);
      setSaved(JSON.stringify(data.settings));
      setMessage({ ok: true, text: "Saved. The sites pick this up within a minute." });
    } else {
      setMessage({ ok: false, text: data.message ?? "Could not save. Try again." });
    }
  };

  const preview = settings.greeting.lines[previewLine].replaceAll("{town}", "Bedford");

  return (
    <div className="space-y-4">
      <section className={card}>
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h2 className={h2}>Greeting beside the chat button</h2>
            <p className={sub}>Once per visit: a ring from the button, then a card from you. Closing it hides it for a week.</p>
          </div>
          <Switch checked={settings.greeting.enabled} onChange={(v) => setGreeting({ enabled: v })} label="Show the greeting" />
        </div>

        <div className={`mt-4 grid gap-6 lg:grid-cols-[1fr_320px] ${settings.greeting.enabled ? "" : "opacity-50"}`}>
          <div className="space-y-4">
            <label className="flex flex-wrap items-center gap-3 text-[14px] text-ink">
              Show after
              <input
                type="number"
                min={2}
                max={120}
                value={settings.greeting.delay}
                onChange={(e) => setGreeting({ delay: Number(e.target.value) })}
                className={`${input} w-20 text-center`}
              />
              seconds on a page, or sooner if they scroll halfway down.
            </label>
            {LINES.map((l) => (
              <label key={l.key} className="block" onFocus={() => setPreviewLine(l.key)}>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-medium text-ink">{l.label}</span>
                  <span className={`text-[11px] tabular-nums ${settings.greeting.lines[l.key].length > 140 ? "text-danger" : "text-faint"}`}>
                    {settings.greeting.lines[l.key].length}/140
                  </span>
                </span>
                <textarea
                  rows={2}
                  value={settings.greeting.lines[l.key]}
                  onChange={(e) => setLine(l.key, e.target.value)}
                  className={`${input} mt-1 h-auto w-full resize-y py-2 leading-snug`}
                />
                <span className="mt-0.5 block text-[12px] text-muted">{l.hint}</span>
              </label>
            ))}
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Preview</p>
            <div role="radiogroup" aria-label="Preview line" className="mt-2 flex flex-wrap gap-1.5">
              {LINES.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  role="radio"
                  aria-checked={previewLine === l.key}
                  onClick={() => setPreviewLine(l.key)}
                  className={`press rounded-full border px-2.5 py-1 text-[12px] font-medium ${
                    previewLine === l.key ? "border-navy bg-navy text-white" : "border-line text-muted"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <div className="mt-3 rounded-2xl bg-canvas p-4 pb-6">
              <GreetingPreview text={preview} />
            </div>
          </div>
        </div>
      </section>

      <section className={card}>
        <h2 className={h2}>Away message</h2>
        <p className={sub}>Posted in a new chat that starts while you&rsquo;re set to Away.</p>
        <textarea
          rows={3}
          value={settings.awayMessage}
          maxLength={400}
          onChange={(e) => set({ awayMessage: e.target.value })}
          className={`${input} mt-3 h-auto w-full resize-y py-2 leading-snug`}
        />
      </section>

      <section className={card}>
        <h2 className={h2}>Chat behaviour</h2>
        <div className="mt-2">
          <Row title="Visitors can send photos and PDFs" note="You can always send them.">
            <Switch checked={settings.visitorAttachments} onChange={(v) => set({ visitorAttachments: v })} label="Visitors can send photos and PDFs" />
          </Row>
          <Row title="Files a visitor can send in one chat" note="Stops one visitor filling the database.">
            <input
              type="number"
              min={1}
              max={200}
              value={settings.visitorFilesPerChat}
              disabled={!settings.visitorAttachments}
              onChange={(e) => set({ visitorFilesPerChat: Number(e.target.value) })}
              className={`${input} w-20 text-center disabled:opacity-50`}
            />
          </Row>
          <Row title="Close quiet chats after" note="Days with no messages. 0 keeps chats open until you close them.">
            <span className="flex items-center gap-2 text-[14px] text-ink-soft">
              <input
                type="number"
                min={0}
                max={365}
                value={settings.autoCloseDays}
                onChange={(e) => set({ autoCloseDays: Number(e.target.value) })}
                className={`${input} w-20 text-center`}
              />
              days
            </span>
          </Row>
        </div>
      </section>

      <section className={card}>
        <h2 className={h2}>Chat button on each site</h2>
        <p className={sub}>Off hides the round button and the greeting. The site&rsquo;s own Ask Michael button still opens the chat.</p>
        <div className="mt-2">
          {sites.map((s) => (
            <Row key={s.id} title={s.domain}>
              <Switch
                checked={settings.launcher[s.id] !== false}
                onChange={(v) => set({ launcher: { ...settings.launcher, [s.id]: v } })}
                label={`Chat button on ${s.domain}`}
              />
            </Row>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={secondary}
          onClick={() => {
            setSettings(defaults);
            setMessage({ ok: true, text: "Defaults filled in. Save to use them." });
          }}
        >
          Restore defaults
        </button>
        {message && !dirty && <p className={`text-[14px] ${message.ok ? "text-ok" : "text-danger"}`}>{message.text}</p>}
      </div>

      {dirty && (
        <div className="anim-rise fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-[1240px] items-center gap-3 sm:px-2">
            <p className="flex-1 text-[14px] text-ink-soft">
              {message && !message.ok ? <span className="text-danger">{message.text}</span> : "You have unsaved changes."}
            </p>
            <button type="button" className={secondary} onClick={() => setSettings(JSON.parse(saved))}>
              Discard
            </button>
            <button type="button" className={primary} onClick={save} disabled={busy}>
              {busy && <Spinner />} Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
