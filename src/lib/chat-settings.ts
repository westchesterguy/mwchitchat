import { db, getSetting, setSetting } from "./db";
import { sites, type SiteId } from "./sites";
import { BUILT_IN_LINES, CUSTOM_MAX, FIRST_LINES, LINE_CONTEXTS, LINE_MAX, type CustomLine, type LineContext } from "./greeting-lines";
import { LOOK_DEFAULTS, readLook, type WidgetLook } from "./widget-look";

export { activeLines, BUILT_IN_LINES, type CustomLine, type GreetingLine, type LineContext } from "./greeting-lines";


/**
 * The chat's behaviour, changed from the developer page. Stored as one
 * setting and laid over these defaults, so a new option needs no migration.
 */
export interface ChatSettings {
  greeting: {
    enabled: boolean;
    /** Seconds on a page before it shows (scrolling halfway can bring it sooner). */
    delay: number;
    /** The rings that spread from the button before the card appears. */
    ripple: {
      /** How many rings; 0 shows none. */
      rings: number;
      /** Seconds each ring takes to spread and fade. */
      speed: number;
      /** Seconds from the first ring to the card. */
      cardAfter: number;
    };
    /** Seconds the typing dots show before the line. 0 shows the line at once. */
    typing: number;
    /** Seconds the card stays on a computer; a phone keeps it 60% as long. */
    stay: number;
    /** Built-in lines switched off, by id. */
    off: string[];
    /** Michael's own lines. */
    custom: CustomLine[];
  };
  /** The chat button and the greeting card's look. */
  look: WidgetLook;
  /** Posted in a new chat that starts while Michael is away. */
  awayMessage: string;
  visitorAttachments: boolean;
  visitorFilesPerChat: number;
  /** Close chats with no messages for this many days; 0 never does. */
  autoCloseDays: number;
  /** Show the round chat button (and greeting) on each site. */
  launcher: Record<SiteId, boolean>;
  /** When Michael is online but a visitor has waited too long for a reply. */
  rescue: {
    enabled: boolean;
    minutes: number;
    message: string;
    /** Notify and email Michael again when it steps in. */
    alert: boolean;
  };
  /** Email Michael's replies to a visitor who has left the site. */
  emailReplies: boolean;
}

/** Added to the away and rescue messages when the visitor's reply will reach them by email. */
export const EMAIL_NOTE = "If you need to go, Michael's reply will also be sent to your email.";

export const CHAT_DEFAULTS: ChatSettings = {
  greeting: {
    enabled: true,
    delay: 8,
    ripple: { rings: 2, speed: 1.7, cardAfter: 0.9 },
    typing: 1.5,
    stay: 25,
    off: [],
    custom: [],
  },
  look: LOOK_DEFAULTS,
  awayMessage: "Michael is away right now. He has your message and details and will follow up with you.",
  visitorAttachments: true,
  visitorFilesPerChat: 30,
  autoCloseDays: 0,
  launcher: { westchesterguy: true, horse: true },
  rescue: {
    enabled: true,
    minutes: 3,
    message: "Sorry for the wait. Michael is tied up at the moment, but he has your message and your details and will get back to you as soon as he can.",
    alert: true,
  },
  emailReplies: true,
};

type Stored = Partial<Omit<ChatSettings, "greeting" | "launcher" | "rescue" | "look">> & {
  rescue?: Partial<ChatSettings["rescue"]>;
  greeting?: Partial<Omit<ChatSettings["greeting"], "ripple">> & {
    ripple?: Partial<ChatSettings["greeting"]["ripple"]>;
    /** The one line per context saved before lines could be switched on and off. */
    lines?: Partial<Record<LineContext, string>>;
  };
  launcher?: Partial<Record<SiteId, boolean>>;
  look?: unknown;
};

/** A line saved in the old one-per-context form becomes a custom line in place of the built-in one it replaced. */
function carryOver(lines: Partial<Record<LineContext, string>> | undefined) {
  const custom: CustomLine[] = [];
  const off: string[] = [];
  for (const context of LINE_CONTEXTS) {
    const text = lines?.[context]?.trim();
    if (!text || text === FIRST_LINES[context].text) continue;
    custom.push({ id: `c-${context}`, context, text, on: true });
    off.push(FIRST_LINES[context].id);
  }
  return { custom, off };
}

export async function getChatSettings(): Promise<ChatSettings> {
  const s = await getSetting<Stored>("chat_settings", {});
  const d = CHAT_DEFAULTS;
  const { lines, ...g } = s.greeting ?? {};
  const old = carryOver(lines);
  return {
    greeting: {
      ...d.greeting,
      ...g,
      ripple: { ...d.greeting.ripple, ...g.ripple },
      off: [...new Set([...(g.off ?? []), ...old.off])],
      custom: [...(g.custom ?? []), ...old.custom],
    },
    look: readLook(s.look).look,
    awayMessage: s.awayMessage ?? d.awayMessage,
    visitorAttachments: s.visitorAttachments ?? d.visitorAttachments,
    visitorFilesPerChat: s.visitorFilesPerChat ?? d.visitorFilesPerChat,
    autoCloseDays: s.autoCloseDays ?? d.autoCloseDays,
    launcher: { ...d.launcher, ...s.launcher },
    rescue: { ...d.rescue, ...s.rescue },
    emailReplies: s.emailReplies ?? d.emailReplies,
  };
}

function text(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() && v.trim().length <= max ? v.trim() : null;
}
function int(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;
}
/** Seconds to a tenth. */
function tenths(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? Math.round(v * 10) / 10 : null;
}

function readCustom(v: unknown): CustomLine[] | string {
  if (!Array.isArray(v)) return [];
  if (v.length > CUSTOM_MAX) return `Up to ${CUSTOM_MAX} lines of your own.`;
  const out: CustomLine[] = [];
  for (const raw of v as Record<string, unknown>[]) {
    const context = LINE_CONTEXTS.find((c) => c === raw?.context);
    const id = typeof raw?.id === "string" && /^c-[a-z0-9-]{1,40}$/.test(raw.id) ? raw.id : null;
    const t = text(raw?.text, LINE_MAX);
    if (!context || !id) return "One of your lines could not be read. Reload the page and try again.";
    if (!t) return `Each of your lines needs text, up to ${LINE_MAX} characters.`;
    if (context === "town" && !t.includes("{town}")) return "A town page line needs {town} where the town's name goes.";
    if (out.some((l) => l.id === id)) return "Two of your lines have the same id. Reload the page and try again.";
    out.push({ id, context, text: t, on: raw.on !== false });
  }
  return out;
}

/** Checks a full settings object from the developer page; returns what is wrong, if anything. */
export async function saveChatSettings(input: unknown): Promise<{ ok: true; settings: ChatSettings } | { ok: false; error: string }> {
  const i = (input ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const g = i.greeting ?? {};
  const custom = readCustom(g.custom);
  if (typeof custom === "string") return { ok: false, error: custom };
  const builtIn = new Set(BUILT_IN_LINES.map((l) => l.id));
  const { look, error: lookError } = readLook(i.look);
  if (lookError) return { ok: false, error: lookError };
  const next: ChatSettings = {
    greeting: {
      enabled: g.enabled === true,
      delay: int(g.delay, 2, 120) ?? NaN,
      ripple: {
        rings: int(g.ripple?.rings, 0, 6) ?? NaN,
        speed: tenths(g.ripple?.speed, 0.5, 5) ?? NaN,
        cardAfter: tenths(g.ripple?.cardAfter, 0, 10) ?? NaN,
      },
      typing: tenths(g.typing, 0, 5) ?? NaN,
      stay: int(g.stay, 5, 120) ?? NaN,
      off: Array.isArray(g.off) ? [...new Set<string>(g.off.filter((id: unknown) => builtIn.has(id as string)))] : [],
      custom,
    },
    look,
    awayMessage: text(i.awayMessage, 400) ?? "",
    visitorAttachments: i.visitorAttachments === true,
    visitorFilesPerChat: int(i.visitorFilesPerChat, 1, 200) ?? NaN,
    autoCloseDays: int(i.autoCloseDays, 0, 365) ?? NaN,
    launcher: Object.fromEntries(Object.keys(sites).map((id) => [id, i.launcher?.[id] !== false])) as Record<SiteId, boolean>,
    rescue: {
      enabled: i.rescue?.enabled === true,
      minutes: int(i.rescue?.minutes, 1, 60) ?? NaN,
      message: text(i.rescue?.message, 400) ?? "",
      alert: i.rescue?.alert === true,
    },
    emailReplies: i.emailReplies === true,
  };
  const gr = next.greeting;
  if (Number.isNaN(gr.delay)) return { ok: false, error: "The greeting delay must be between 2 and 120 seconds." };
  if (Number.isNaN(gr.ripple.rings)) return { ok: false, error: "Rings must be between 0 and 6." };
  if (Number.isNaN(gr.ripple.speed)) return { ok: false, error: "Each ring takes between 0.5 and 5 seconds." };
  if (Number.isNaN(gr.ripple.cardAfter)) return { ok: false, error: "The card can follow the ring by 0 to 10 seconds." };
  if (Number.isNaN(gr.typing)) return { ok: false, error: "The typing dots show for 0 to 5 seconds." };
  if (Number.isNaN(gr.stay)) return { ok: false, error: "The card stays between 5 and 120 seconds." };
  if (!next.awayMessage) return { ok: false, error: "The away message needs text, up to 400 characters." };
  if (Number.isNaN(next.visitorFilesPerChat)) return { ok: false, error: "Files per chat must be between 1 and 200." };
  if (Number.isNaN(next.autoCloseDays)) return { ok: false, error: "Auto-close must be between 0 and 365 days." };
  if (Number.isNaN(next.rescue.minutes)) return { ok: false, error: "The rescue wait must be between 1 and 60 minutes." };
  if (!next.rescue.message) return { ok: false, error: "The rescue message needs text, up to 400 characters." };
  await setSetting("chat_settings", next);
  await dropUnusedImages(next.look);
  return { ok: true, settings: next };
}

/**
 * Uploaded button and greeting images no longer in use. One uploaded in the
 * last day is kept: it may be on the developer page, waiting to be saved.
 */
async function dropUnusedImages(look: WidgetLook) {
  const keep = [look.iconImage, look.card.photoImage].filter((v): v is string => !!v);
  await db()`
    delete from widget_images
    where created_at < now() - interval '1 day' and not (id = any(${keep}::uuid[]))`;
}
