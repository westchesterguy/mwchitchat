import { getSetting, setSetting } from "./db";
import { sites, type SiteId } from "./sites";

/**
 * The chat's behaviour, changed from the developer page. Stored as one
 * setting and laid over these defaults, so a new option needs no migration.
 */
export interface ChatSettings {
  greeting: {
    enabled: boolean;
    /** Seconds on a page before it shows (scrolling halfway can bring it sooner). */
    delay: number;
    lines: {
      general: string;
      /** {town} is replaced with the town's name. */
      town: string;
      horse: string;
      away: string;
    };
  };
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
    lines: {
      general: "Have a question about a house or a town? I'm here.",
      town: "Looking at {town}? Ask me anything about the town or a house.",
      horse: "Questions about a farm, barn or acreage? Ask me here.",
      away: "Leave me a message and I'll follow up.",
    },
  },
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

type Stored = Partial<Omit<ChatSettings, "greeting" | "launcher" | "rescue">> & {
  rescue?: Partial<ChatSettings["rescue"]>;
  greeting?: Partial<Omit<ChatSettings["greeting"], "lines">> & { lines?: Partial<ChatSettings["greeting"]["lines"]> };
  launcher?: Partial<Record<SiteId, boolean>>;
};

export async function getChatSettings(): Promise<ChatSettings> {
  const s = await getSetting<Stored>("chat_settings", {});
  const d = CHAT_DEFAULTS;
  return {
    greeting: {
      ...d.greeting,
      ...s.greeting,
      lines: { ...d.greeting.lines, ...s.greeting?.lines },
    },
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

/** Checks a full settings object from the developer page; returns what is wrong, if anything. */
export async function saveChatSettings(input: unknown): Promise<{ ok: true; settings: ChatSettings } | { ok: false; error: string }> {
  const i = (input ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const g = i.greeting ?? {};
  const lines = g.lines ?? {};
  const next: ChatSettings = {
    greeting: {
      enabled: g.enabled === true,
      delay: int(g.delay, 2, 120) ?? NaN,
      lines: {
        general: text(lines.general, 140) ?? "",
        town: text(lines.town, 140) ?? "",
        horse: text(lines.horse, 140) ?? "",
        away: text(lines.away, 140) ?? "",
      },
    },
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
  if (Number.isNaN(next.greeting.delay)) return { ok: false, error: "The greeting delay must be between 2 and 120 seconds." };
  const blank = Object.entries(next.greeting.lines).find(([, v]) => !v);
  if (blank) return { ok: false, error: "Each greeting line needs text, up to 140 characters." };
  if (!next.greeting.lines.town.includes("{town}")) return { ok: false, error: "The town line needs {town} where the town's name goes." };
  if (!next.awayMessage) return { ok: false, error: "The away message needs text, up to 400 characters." };
  if (Number.isNaN(next.visitorFilesPerChat)) return { ok: false, error: "Files per chat must be between 1 and 200." };
  if (Number.isNaN(next.autoCloseDays)) return { ok: false, error: "Auto-close must be between 0 and 365 days." };
  if (Number.isNaN(next.rescue.minutes)) return { ok: false, error: "The rescue wait must be between 1 and 60 minutes." };
  if (!next.rescue.message) return { ok: false, error: "The rescue message needs text, up to 400 characters." };
  await setSetting("chat_settings", next);
  return { ok: true, settings: next };
}
