"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { activeLines, BUILT_IN_LINES, CUSTOM_MAX, LINE_MAX, type CustomLine, type LineContext } from "@/lib/greeting-lines";
import { HEADSHOT_URL, MARK_URL } from "@/lib/sites";
import {
  imageUrl,
  LOOK_LIMITS,
  lookForWidget,
  SOTHEBYS_BLUE,
  type CardForm,
  type CardPhoto,
  type IconKind,
  type WidgetLook,
} from "@/lib/widget-look";
import { ChatIcon, PlayIcon, PlusIcon, Spinner, TrashIcon } from "../ui/icons";
import { Switch } from "../ui/Switch";
import { card, h2, input, secondary, sub } from "./api";
import { SaveBar, useChatSettings, type ChatSettings } from "./useChatSettings";

const TOWN = "Bedford";

const CONTEXTS: { id: LineContext; label: string; hint: string }[] = [
  { id: "general", label: "Most pages", hint: "westchesterguy.com pages other than a town page." },
  {
    id: "town",
    label: "Town pages",
    hint: "Town pages such as /communities/bedford. {town} becomes the town's name. With every town line off, these pages use the lines for most pages.",
  },
  { id: "horse", label: "Horse site", hint: "Every page on westchesterhorseproperties.com." },
  { id: "away", label: "While you're away", hint: "Both sites, while you're set to Away in the chat app." },
];

const CARD_WIDTH = { small: 252, medium: 292, large: 340 };

const PRESETS = [
  { name: "Sotheby's blue", color: SOTHEBYS_BLUE, icon: "#ffffff" },
  { name: "White", color: "#ffffff", icon: SOTHEBYS_BLUE },
];

// ---------------------------------------------------------------- helpers

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const tenth = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "");

/** Shrinks an image in the browser before it is uploaded: a logo to 256 px, a photo to a 192 px square. */
async function shrink(file: File, kind: "logo" | "photo"): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const w0 = img.naturalWidth || 256;
    const h0 = img.naturalHeight || 256;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    if (kind === "photo") {
      canvas.width = canvas.height = 192;
      const side = Math.min(w0, h0);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 192, 192);
      ctx.drawImage(img, (w0 - side) / 2, (h0 - side) / 2, side, side, 0, 0, 192, 192);
      return await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.88));
    }
    const scale = 256 / Math.max(w0, h0);
    canvas.width = Math.max(1, Math.round(w0 * scale));
    canvas.height = Math.max(1, Math.round(h0 * scale));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((r) => canvas.toBlob(r, "image/png"));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function upload(file: File, kind: "logo" | "photo"): Promise<{ id: string } | { error: string }> {
  const blob = await shrink(file, kind);
  if (!blob) return { error: "This image can't be opened here. Try a PNG or JPEG." };
  try {
    const res = await fetch("/developer/api/images", { method: "POST", headers: { "content-type": blob.type }, body: blob });
    if (res.status === 401) window.location.reload();
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    return res.ok && data.id ? { id: data.id } : { error: data.message ?? "Could not upload. Try again." };
  } catch {
    return { error: "Could not upload. Try again." };
  }
}

function previewConfig(s: ChatSettings, context: LineContext) {
  const g = s.greeting;
  let lines = activeLines(g, context);
  if (!lines.length && context === "town") lines = activeLines(g, "general");
  const shown = lines.map((l) => ({ id: l.id, text: l.text.replaceAll("{town}", TOWN) }));
  return {
    launcher: true,
    look: lookForWidget(s.look),
    greeting:
      g.enabled && shown.length
        ? {
            delay: g.delay,
            online: context !== "away",
            name: "Michael Winter",
            photo: HEADSHOT_URL,
            text: shown[0].text,
            lines: shown,
            ripple: g.ripple,
            typing: g.typing,
            stay: g.stay,
          }
        : null,
  };
}

// ---------------------------------------------------------------- small controls

function Field({ label, children, note }: { label: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="border-t border-line py-4 first:border-0 first:pt-1">
      <p className="text-[13px] font-medium text-ink">{label}</p>
      <div className="mt-2">{children}</div>
      {note && <div className="mt-2 text-[12px] text-muted">{note}</div>}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  note,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  note?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        <span className="text-[13px] tabular-nums text-ink-soft">
          {step < 1 ? tenth(value) : value} {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(step < 1 ? Math.round(Number(e.target.value) * 10) / 10 : Number(e.target.value))}
        className="mt-2 w-full accent-[var(--color-navy)]"
      />
      {note && <span className="mt-0.5 block text-[12px] text-muted">{note}</span>}
    </label>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex flex-wrap gap-1 rounded-xl bg-canvas p-1 ${disabled ? "opacity-50" : ""}`}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={`press rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
            value === o.id ? "bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value.toLowerCase())}
        className="h-10 w-11 shrink-0 cursor-pointer rounded-xl border border-line bg-surface p-1"
      />
      <span className="min-w-0">
        <span className="block text-[12px] text-muted">{label}</span>
        <input
          value={text}
          aria-label={`${label}, as a hex code`}
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            const v = e.target.value.trim().toLowerCase();
            if (/^#[0-9a-f]{6}$/.test(v)) onChange(v);
          }}
          onBlur={() => setText(value)}
          className="w-[84px] bg-transparent font-mono text-[13px] text-ink outline-none"
        />
      </span>
    </div>
  );
}

/** A round button as it would look with an icon, for the icon choices. */
function MiniButton({ look, icon }: { look: WidgetLook; icon: IconKind }) {
  const style = { background: look.color, color: look.iconColor };
  return (
    <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full shadow-[0_3px_10px_rgba(0,35,73,0.25)]" style={style}>
      {icon === "chat" && <ChatIcon className="h-[22px] w-[22px]" />}
      {icon === "mark" && (
        <span className="block w-[42%] overflow-hidden aspect-[590/653]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MARK_URL} alt="" className="block h-auto w-full max-w-none" />
        </span>
      )}
      {icon === "photo" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={HEADSHOT_URL} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {icon === "image" &&
        (look.iconImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl(look.iconImage)} alt="" className="h-[62%] w-[62%] object-contain" />
        ) : (
          <PlusIcon className="h-5 w-5" />
        ))}
    </span>
  );
}

function Tile({
  selected,
  onClick,
  label,
  children,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={`press flex min-w-[92px] flex-1 flex-col items-center gap-2 rounded-xl border p-3 text-[12px] font-medium transition-colors disabled:opacity-40 ${
        selected ? "border-navy bg-navy-tint text-ink" : "border-line text-muted hover:border-ink-soft/40"
      }`}
    >
      {children}
      {label}
    </button>
  );
}

/** A small drawing of each greeting form. */
function FormSketch({ form }: { form: CardForm }) {
  const bar = "block h-1.5 rounded-full bg-current opacity-35";
  if (form === "bubble")
    return (
      <span className="flex h-11 w-full items-center justify-end">
        <span className="flex w-[70%] flex-col gap-1 rounded-[10px] rounded-br-[3px] border border-current/30 bg-surface p-1.5">
          <span className={`${bar} w-full`} />
          <span className={`${bar} w-2/3`} />
        </span>
      </span>
    );
  if (form === "compact")
    return (
      <span className="flex h-11 w-full items-center justify-end">
        <span className="flex w-[85%] items-center gap-1.5 rounded-full border border-current/30 bg-surface p-1">
          <span className="h-4 w-4 shrink-0 rounded-full bg-current opacity-50" />
          <span className={`${bar} flex-1`} />
        </span>
      </span>
    );
  return (
    <span className="flex h-11 w-full items-center justify-end">
      <span className="flex w-[90%] gap-1.5 rounded-lg border border-current/30 bg-surface p-1.5">
        <span className="h-5 w-5 shrink-0 rounded-full bg-current opacity-50" />
        <span className="flex flex-1 flex-col gap-1">
          <span className={`${bar} w-1/2 opacity-60`} />
          <span className={`${bar} w-full`} />
          <span className={`${bar} w-3/4`} />
        </span>
      </span>
    </span>
  );
}

function UploadButton({ kind, onDone, label }: { kind: "logo" | "photo"; onDone: (id: string) => void; label: string }) {
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <input
        ref={picker}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          setError(null);
          const result = await upload(file, kind);
          setBusy(false);
          if ("id" in result) onDone(result.id);
          else setError(result.error);
        }}
      />
      <button type="button" className={secondary} disabled={busy} onClick={() => picker.current?.click()}>
        {busy && <Spinner />} {label}
      </button>
      {error && <span className="text-[13px] text-danger">{error}</span>}
    </span>
  );
}

// ---------------------------------------------------------------- the panel

/** The chat button and the greeting beside it: look, timing and lines, with a live preview. */
export function WidgetPanel() {
  const state = useChatSettings();
  const { settings, defaults, sites, set, setMessage } = state;
  const [context, setContext] = useState<LineContext>("general");
  const [device, setDevice] = useState<"computer" | "phone">("computer");
  const [shownId, setShownId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);

  // The preview: widget.js in a frame, told about every change.
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(0);
  const lastTiming = useRef<string | null>(null);
  // The computer preview shows the page's corner at full size, smaller only if the button and card would not fit.
  const box = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(360);
  const loaded = settings !== null;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [loaded]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.source === frame.current?.contentWindow && e.data?.type === "mwchat:preview-ready") {
        lastTiming.current = null;
        setReady((n) => n + 1);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const config = useMemo(() => (settings ? previewConfig(settings, context) : null), [settings, context]);
  const shownLine = useMemo(() => {
    if (!shownId || !config?.greeting) return null;
    return config.greeting.lines.find((l) => l.id === shownId) ?? null;
  }, [shownId, config]);

  const post = (play: boolean) => {
    if (!config || !ready) return;
    frame.current?.contentWindow?.postMessage({ type: "mwchat:preview", config, play, line: shownLine }, window.location.origin);
  };

  // A change to the timing replays the rings; anything else redraws in place.
  useEffect(() => {
    if (!config || !ready || !settings) return;
    const g = settings.greeting;
    const timing = JSON.stringify([g.ripple, g.typing]);
    const play = lastTiming.current === null || lastTiming.current !== timing;
    const t = setTimeout(() => {
      lastTiming.current = timing;
      post(play);
    }, play ? 400 : 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, ready, shownLine]);

  if (!settings || !defaults) {
    return (
      <div className={card} aria-busy>
        <span className="skeleton block h-5 w-40" />
        <span className="skeleton mt-4 block h-64 w-full !rounded-xl" />
      </div>
    );
  }

  const look = settings.look;
  const g = settings.greeting;
  const setLook = (patch: Partial<WidgetLook>) => set({ look: { ...look, ...patch } });
  const setCard = (patch: Partial<WidgetLook["card"]>) => setLook({ card: { ...look.card, ...patch } });
  const setGreeting = (patch: Partial<ChatSettings["greeting"]>) => set({ greeting: { ...g, ...patch } });
  const setRipple = (patch: Partial<ChatSettings["greeting"]["ripple"]>) => setGreeting({ ripple: { ...g.ripple, ...patch } });

  const lightButton = luminance(look.color) > 0.4;
  const iconContrast = contrast(look.color, look.iconColor);

  const builtIn = BUILT_IN_LINES.filter((l) => l.context === context);
  const custom = g.custom.filter((l) => l.context === context);
  const onCount = (c: LineContext) => activeLines(g, c).length;
  const setCustom = (id: string, patch: Partial<CustomLine>) =>
    setGreeting({ custom: g.custom.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  const lineError = (text: string) => {
    const t = text.trim();
    if (!t) return "Needs text.";
    if (t.length > LINE_MAX) return `Up to ${LINE_MAX} characters.`;
    if (context === "town" && !t.includes("{town}")) return "Put {town} where the town's name goes.";
    return null;
  };
  const addLine = () => {
    const error = lineError(draft);
    if (error) return setDraftError(error);
    if (g.custom.length >= CUSTOM_MAX) return setDraftError(`Up to ${CUSTOM_MAX} lines of your own.`);
    const id = `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    setGreeting({ custom: [...g.custom, { id, context, text: draft.trim(), on: true }] });
    setDraft("");
    setDraftError(null);
    setShownId(id);
  };

  const r = g.ripple;
  const timeline =
    (r.rings ? `${r.rings} ${r.rings === 1 ? "ring runs" : "rings run"} ${tenth(r.rings * r.speed)} s. ` : "No rings. ") +
    `The card appears at ${tenth(r.cardAfter)} s` +
    (g.typing ? `, its line at ${tenth(r.cardAfter + g.typing)} s` : "") +
    `, and it leaves at ${tenth(r.cardAfter + g.stay)} s (${tenth(r.cardAfter + g.stay * 0.6)} s on a phone).`;

  const ctx = CONTEXTS.find((c) => c.id === context)!;
  const scale = device === "computer" ? Math.min(1, boxWidth / (look.x + Math.max(CARD_WIDTH[look.card.size], look.size) + 24)) : 1;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
      {/* The preview, beside the settings on a wide screen. */}
      <section className={`${card} lg:sticky lg:top-[64px] lg:order-2`}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className={`${h2} mr-auto`}>Preview</h2>
          <Segmented
            label="Preview on"
            value={device}
            options={[
              { id: "computer", label: "Computer" },
              { id: "phone", label: "Phone" },
            ]}
            onChange={setDevice}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Page">
          {CONTEXTS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={context === c.id}
              onClick={() => {
                setContext(c.id);
                setShownId(null);
              }}
              className={`press rounded-full border px-2.5 py-1 text-[12px] font-medium ${
                context === c.id ? "border-navy bg-navy text-white" : "border-line text-muted"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div
          ref={box}
          className={`relative mt-3 overflow-hidden rounded-xl border border-line bg-canvas ${
            device === "computer" ? "h-[480px]" : "mx-auto h-[600px] w-[340px]"
          }`}
        >
          <iframe
            ref={frame}
            src="/developer/preview"
            title="Preview of the chat button and greeting"
            className={`absolute bottom-0 border-0 ${device === "computer" ? (look.side === "left" ? "left-0" : "right-0") : "left-0 h-full w-full"}`}
            style={
              device === "computer"
                ? {
                    width: 1100,
                    height: 480 / scale,
                    transform: scale < 1 ? `scale(${scale})` : undefined,
                    transformOrigin: look.side === "left" ? "bottom left" : "bottom right",
                  }
                : undefined
            }
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className={secondary} onClick={() => post(true)} disabled={!g.enabled}>
            <PlayIcon className="h-4 w-4" /> Play
          </button>
          <p className="min-w-0 flex-1 text-[12px] text-muted">
            {g.enabled
              ? `Plays at once here. On the sites it starts after ${g.delay} seconds, or sooner if the visitor scrolls halfway down.`
              : "The greeting is off; only the button shows."}
          </p>
        </div>
      </section>

      <div className="space-y-4 lg:order-1">
        {/* The button. */}
        <section className={card}>
          <h2 className={h2}>Chat button</h2>
          <p className={sub}>The round button in the corner of every page.</p>
          <div className="mt-3">
            <Field label="Show it on">
              <div className="space-y-2">
                {sites.map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="flex-1 text-[14px] text-ink">{s.domain}</span>
                    <Switch
                      checked={settings.launcher[s.id as keyof typeof settings.launcher] !== false}
                      onChange={(v) => set({ launcher: { ...settings.launcher, [s.id]: v } })}
                      label={`Chat button on ${s.domain}`}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-muted">Off hides the button and the greeting there. The site&rsquo;s own Ask Michael button still opens the chat.</p>
            </Field>

            <Field
              label="Colors"
              note={
                iconContrast < 3 && look.icon === "chat" ? (
                  <span className="text-warn">The icon is hard to see on this color.</span>
                ) : null
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                {PRESETS.map((p) => {
                  const on = look.color === p.color && look.iconColor === p.icon;
                  return (
                    <button
                      key={p.name}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setLook({ color: p.color, iconColor: p.icon })}
                      className={`press inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[13px] font-medium ${
                        on ? "border-navy bg-navy-tint text-ink" : "border-line text-muted"
                      }`}
                    >
                      <span className="h-6 w-6 rounded-full border border-line" style={{ background: p.color }} />
                      {p.name}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-5">
                <ColorField label="Button" value={look.color} onChange={(v) => setLook({ color: v })} />
                <ColorField label="Icon" value={look.iconColor} onChange={(v) => setLook({ iconColor: v })} />
              </div>
            </Field>

            <Field
              label="Icon"
              note={
                look.icon === "mark" && lightButton ? (
                  <span className="text-warn">The mark is white, so it won&rsquo;t show on a light button.</span>
                ) : look.icon === "photo" ? (
                  "Your headshot, as on the hub's About page."
                ) : look.icon === "image" ? (
                  "A PNG with a clear background works best. It is fitted inside the button."
                ) : null
              }
            >
              <div role="radiogroup" aria-label="Icon" className="flex flex-wrap gap-2">
                {(
                  [
                    ["chat", "Chat bubble"],
                    ["mark", "MW mark"],
                    ["photo", "Your photo"],
                    ["image", "Your image"],
                  ] as [IconKind, string][]
                ).map(([id, label]) => (
                  <Tile key={id} selected={look.icon === id} onClick={() => setLook({ icon: id })} label={label}>
                    <MiniButton look={look} icon={id} />
                  </Tile>
                ))}
              </div>
              {look.icon === "image" && (
                <div className="mt-3">
                  <UploadButton
                    kind="logo"
                    label={look.iconImage ? "Replace image" : "Upload an image"}
                    onDone={(id) => setLook({ iconImage: id, icon: "image" })}
                  />
                </div>
              )}
            </Field>

            <Field label="Size and place">
              <div className="space-y-4">
                <Slider label="Button size" value={look.size} min={LOOK_LIMITS.size[0]} max={LOOK_LIMITS.size[1]} unit="px" onChange={(v) => setLook({ size: v })} />
                <div>
                  <p className="text-[13px] font-medium text-ink">Corner</p>
                  <div className="mt-2">
                    <Segmented
                      label="Corner"
                      value={look.side}
                      options={[
                        { id: "right", label: "Bottom right" },
                        { id: "left", label: "Bottom left" },
                      ]}
                      onChange={(v) => setLook({ side: v })}
                    />
                  </div>
                </div>
                <Slider label="From the side" value={look.x} min={LOOK_LIMITS.x[0]} max={LOOK_LIMITS.x[1]} unit="px" onChange={(v) => setLook({ x: v })} />
                <Slider
                  label="From the bottom"
                  value={look.y}
                  min={LOOK_LIMITS.y[0]}
                  max={LOOK_LIMITS.y[1]}
                  unit="px"
                  note="Raise it if a site has its own bar or button along the bottom."
                  onChange={(v) => setLook({ y: v })}
                />
              </div>
            </Field>
          </div>
        </section>

        {/* The greeting card. */}
        <section className={card}>
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h2 className={h2}>Greeting</h2>
              <p className={sub}>Once per visit, rings from the button and then a line from you. Closing it hides it for a week.</p>
            </div>
            <Switch checked={g.enabled} onChange={(v) => setGreeting({ enabled: v })} label="Show the greeting" />
          </div>
          <div className={`mt-3 ${g.enabled ? "" : "opacity-50"}`}>
            <Field label="Form">
              <div role="radiogroup" aria-label="Form" className="flex flex-wrap gap-2">
                {(
                  [
                    ["card", "Card"],
                    ["compact", "Compact"],
                    ["bubble", "Bubble"],
                  ] as [CardForm, string][]
                ).map(([id, label]) => (
                  <Tile key={id} selected={look.card.form === id} onClick={() => setCard({ form: id })} label={label}>
                    <FormSketch form={id} />
                  </Tile>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-muted">
                {look.card.form === "card"
                  ? "Your picture, your name and the line."
                  : look.card.form === "compact"
                    ? "A slim pill: a small picture and the line."
                    : "A chat bubble with the line alone."}
              </p>
            </Field>
            <Field label="Size and style">
              <div className="flex flex-wrap gap-3">
                <Segmented
                  label="Card size"
                  value={look.card.size}
                  options={[
                    { id: "small", label: "Small" },
                    { id: "medium", label: "Medium" },
                    { id: "large", label: "Large" },
                  ]}
                  onChange={(v) => setCard({ size: v })}
                />
                <Segmented
                  label="Card style"
                  value={look.card.style}
                  options={[
                    { id: "light", label: "Light" },
                    { id: "dark", label: "Dark" },
                  ]}
                  onChange={(v) => setCard({ style: v })}
                />
              </div>
              <p className="mt-2 text-[12px] text-muted">Dark uses the button&rsquo;s color, or Sotheby&rsquo;s blue with a light button.</p>
            </Field>
            <Field label="Picture">
              <Segmented
                label="Picture"
                value={look.card.photo}
                disabled={look.card.form === "bubble"}
                options={
                  [
                    { id: "headshot", label: "Your photo" },
                    { id: "mark", label: "MW mark" },
                    { id: "image", label: "Upload" },
                    { id: "none", label: "None" },
                  ] as { id: CardPhoto; label: string }[]
                }
                onChange={(v) => setCard({ photo: v })}
              />
              {look.card.form === "bubble" && <p className="mt-2 text-[12px] text-muted">The bubble shows no picture.</p>}
              {look.card.photo === "image" && look.card.form !== "bubble" && (
                <div className="mt-3 flex items-center gap-3">
                  {look.card.photoImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl(look.card.photoImage)} alt="" className="h-11 w-11 rounded-full object-cover" />
                  )}
                  <UploadButton
                    kind="photo"
                    label={look.card.photoImage ? "Replace photo" : "Upload a photo"}
                    onDone={(id) => setCard({ photoImage: id, photo: "image" })}
                  />
                </div>
              )}
            </Field>
          </div>
        </section>

        {/* Timing. */}
        <section className={card}>
          <h2 className={h2}>Rings and timing</h2>
          <p className={sub}>Changes here replay in the preview.</p>
          <div className={`mt-4 grid gap-5 sm:grid-cols-2 ${g.enabled ? "" : "opacity-50"}`}>
            <label className="block sm:col-span-2">
              <span className="text-[13px] font-medium text-ink">Show after</span>
              <span className="mt-1 flex flex-wrap items-center gap-3 text-[14px] text-ink">
                <input
                  type="number"
                  min={2}
                  max={120}
                  value={g.delay}
                  onChange={(e) => setGreeting({ delay: Number(e.target.value) })}
                  className={`${input} w-20 text-center`}
                />
                seconds on a page, or sooner if they scroll halfway down.
              </span>
            </label>
            <Slider label="Rings" value={r.rings} min={0} max={6} unit={r.rings === 1 ? "ring" : "rings"} onChange={(v) => setRipple({ rings: v })} />
            <Slider label="Each ring takes" value={r.speed} min={0.5} max={5} step={0.1} unit="s" note="Lower is faster." onChange={(v) => setRipple({ speed: v })} />
            <Slider label="Card appears" value={r.cardAfter} min={0} max={10} step={0.1} unit="s" note="After the first ring starts." onChange={(v) => setRipple({ cardAfter: v })} />
            <Slider label="Typing dots" value={g.typing} min={0} max={5} step={0.1} unit="s" note="0 shows the line at once." onChange={(v) => setGreeting({ typing: v })} />
            <Slider label="Stays on screen" value={g.stay} min={5} max={120} unit="s" note="A phone keeps it 60% as long." onChange={(v) => setGreeting({ stay: v })} />
          </div>
          <p className="mt-4 rounded-xl bg-canvas px-3 py-2.5 text-[13px] text-ink-soft">{timeline}</p>
        </section>

        {/* Lines. */}
        <section className={card}>
          <h2 className={h2}>Greeting lines</h2>
          <p className={sub}>
            Each visit gets a line the visitor hasn&rsquo;t seen yet. Once they&rsquo;ve seen them all, the lines start over, never with the
            last one shown.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Where the lines show">
            {CONTEXTS.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={context === c.id}
                onClick={() => {
                  setContext(c.id);
                  setShownId(null);
                  setDraftError(null);
                }}
                className={`press rounded-full border px-3 py-1.5 text-[13px] font-medium ${
                  context === c.id ? "border-navy bg-navy text-white" : "border-line text-muted"
                }`}
              >
                {c.label} <span className={context === c.id ? "text-white/70" : "text-faint"}>{onCount(c.id)} on</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-muted">{ctx.hint}</p>
          {onCount(context) === 0 && (
            <p className="mt-2 text-[13px] text-warn">
              {context === "town" ? "No town lines are on, so town pages use the lines for most pages." : "No lines are on here, so no greeting shows on these pages."}
            </p>
          )}

          <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Built in</p>
          <ul className="mt-1">
            {builtIn.map((l) => {
              const on = !g.off.includes(l.id);
              return (
                <li key={l.id} className="flex items-center gap-3 border-t border-line py-2.5 first:border-0">
                  <p className={`min-w-0 flex-1 text-[14px] ${on ? "text-ink" : "text-faint line-through decoration-faint/50"}`}>{l.text}</p>
                  <ShowButton active={shownId === l.id} disabled={!on || !g.enabled} onClick={() => setShownId(l.id)} />
                  <Switch
                    checked={on}
                    onChange={(v) => setGreeting({ off: v ? g.off.filter((id) => id !== l.id) : [...g.off, l.id] })}
                    label={`Use the line: ${l.text}`}
                  />
                </li>
              );
            })}
          </ul>

          <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Your own</p>
          <ul className="mt-1">
            {custom.length === 0 && <li className="py-2 text-[13px] text-muted">None yet for {ctx.label.toLowerCase()}.</li>}
            {custom.map((l) => {
              const error = lineError(l.text);
              return (
                <li key={l.id} className="border-t border-line py-2.5 first:border-0">
                  <div className="flex items-center gap-3">
                    <input
                      value={l.text}
                      maxLength={LINE_MAX + 20}
                      aria-label="Your line"
                      onChange={(e) => setCustom(l.id, { text: e.target.value })}
                      className={`${input} min-w-0 flex-1 ${error ? "border-danger/60" : ""}`}
                    />
                    <ShowButton active={shownId === l.id} disabled={!l.on || !g.enabled} onClick={() => setShownId(l.id)} />
                    <Switch checked={l.on} onChange={(v) => setCustom(l.id, { on: v })} label={`Use the line: ${l.text}`} />
                    <button
                      type="button"
                      aria-label="Delete this line"
                      onClick={() => setGreeting({ custom: g.custom.filter((x) => x.id !== l.id) })}
                      className="press rounded-full p-2 text-muted hover:bg-canvas hover:text-danger"
                    >
                      <TrashIcon className="h-[18px] w-[18px]" />
                    </button>
                  </div>
                  <p className={`mt-1 text-[12px] ${error ? "text-danger" : "text-faint"}`}>
                    {error ?? `${l.text.trim().length}/${LINE_MAX}`}
                  </p>
                </li>
              );
            })}
          </ul>
          <form
            className="mt-3 flex flex-wrap items-start gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addLine();
            }}
          >
            <div className="min-w-[220px] flex-1">
              <input
                value={draft}
                maxLength={LINE_MAX + 20}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setDraftError(null);
                }}
                placeholder={context === "town" ? "A line with {town} in it" : "Add a line of your own"}
                aria-label="New line"
                className={`${input} w-full`}
              />
              <p className={`mt-1 text-[12px] ${draftError ? "text-danger" : "text-faint"}`}>
                {draftError ?? `${draft.trim().length}/${LINE_MAX}`}
              </p>
            </div>
            <button type="submit" className={secondary}>
              <PlusIcon className="h-4 w-4" /> Add
            </button>
          </form>
        </section>

        <SaveBar
          state={state}
          onRestore={() => {
            set({
              greeting: { ...defaults.greeting, custom: g.custom },
              look: defaults.look,
              launcher: defaults.launcher,
            });
            setMessage({ ok: true, text: "Defaults filled in; your own lines are kept. Save to use them." });
          }}
        />
      </div>
    </div>
  );
}

function ShowButton({ active, disabled, onClick }: { active: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`press shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium disabled:opacity-40 ${
        active ? "bg-navy text-white" : "text-accent hover:bg-navy-tint"
      }`}
    >
      Preview
    </button>
  );
}
