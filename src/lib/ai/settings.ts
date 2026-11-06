import { getSetting, setSetting } from "../db";
import { sites, type SiteId } from "../sites";
import { getProvider } from "./providers";

/**
 * The assistant's settings, from the developer page's AI integration tab.
 * Off by default: while off, nothing is ever sent to an AI service.
 */

export type AiMode = "drafts" | "cover" | "always";
export type Effort = "low" | "medium" | "high";

export interface AiSettings {
  enabled: boolean;
  mode: AiMode;
  provider: string;
  /** Per provider, so switching back and forth keeps each choice. */
  models: Record<string, string>;
  /** Overrides of the OpenAI-style base address, per provider. */
  baseUrls: Record<string, string>;
  /** Claude only: how hard it thinks before answering. Low suits chat. */
  effort: Effort;
  name: string;
  instructions: string;
  context: string;
  siteContext: Record<SiteId, string>;
  handoff: string;
  askContact: boolean;
  matchLanguage: boolean;
  length: "short" | "medium";
  notify: boolean;
  maxPerChat: number;
  maxPerMonth: number;
}

export const AI_DEFAULTS: AiSettings = {
  enabled: false,
  mode: "drafts",
  provider: "anthropic",
  models: {},
  baseUrls: {},
  effort: "low",
  name: "Michael's assistant",
  instructions:
    "Write like a person, in a professional, warm and concise voice. No emoji. No real-estate clichés such as stunning, must-see, dream home or nestled. Never use em dashes. Keep replies to a few sentences.",
  context: "",
  siteContext: { westchesterguy: "", horse: "" },
  handoff:
    "Pricing, valuations and what a home is worth\nShowings, tours and appointments\nOffers, negotiations and contracts\nLegal, tax, mortgage and financing questions\nAnything you are not sure of",
  askContact: true,
  matchLanguage: true,
  length: "short",
  notify: true,
  maxPerChat: 10,
  maxPerMonth: 500,
};

type Stored = Partial<AiSettings>;

export async function getAiSettings(): Promise<AiSettings> {
  const s = await getSetting<Stored>("ai_settings", {});
  return {
    ...AI_DEFAULTS,
    ...s,
    models: { ...AI_DEFAULTS.models, ...s.models },
    baseUrls: { ...AI_DEFAULTS.baseUrls, ...s.baseUrls },
    siteContext: { ...AI_DEFAULTS.siteContext, ...s.siteContext },
  };
}

/** The model in use for a provider: the one chosen, else its known default. */
export function modelFor(s: AiSettings, providerId = s.provider): string {
  return s.models[providerId]?.trim() || getProvider(providerId)?.defaultModel || "";
}

/** The base address for an OpenAI-style provider: the override, else its own. */
export function baseUrlFor(s: AiSettings, providerId = s.provider): string {
  return (s.baseUrls[providerId]?.trim() || getProvider(providerId)?.baseUrl || "").replace(/\/+$/, "");
}

function text(v: unknown, max: number, required = false): string | null {
  if (typeof v !== "string") return required ? null : "";
  const t = v.trim();
  if (t.length > max || (required && !t)) return null;
  return t;
}
function int(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;
}
function map(v: unknown, max: number): Record<string, string> {
  const out: Record<string, string> = {};
  if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v)) {
      if (getProvider(k) && typeof val === "string" && val.trim().length <= max) out[k] = val.trim();
    }
  }
  return out;
}

/** Checks the settings from the developer page; says what is wrong, if anything. */
export function checkAiSettings(input: unknown): { ok: true; settings: AiSettings } | { ok: false; error: string } {
  const i = (input ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!getProvider(i.provider)) return { ok: false, error: "Choose an AI service." };
  if (!["drafts", "cover", "always"].includes(i.mode)) return { ok: false, error: "Choose a mode." };
  if (!["low", "medium", "high"].includes(i.effort)) return { ok: false, error: "Choose a thinking level." };
  const name = text(i.name, 60, true);
  if (!name) return { ok: false, error: "The assistant needs a name, up to 60 characters." };
  const instructions = text(i.instructions, 4000);
  if (instructions === null) return { ok: false, error: "Instructions can be up to 4,000 characters." };
  const context = text(i.context, 30000);
  if (context === null) return { ok: false, error: "The context can be up to 30,000 characters." };
  const siteContext = {} as Record<SiteId, string>;
  for (const id of Object.keys(sites) as SiteId[]) {
    const t = text(i.siteContext?.[id], 10000);
    if (t === null) return { ok: false, error: `The ${sites[id].domain} context can be up to 10,000 characters.` };
    siteContext[id] = t;
  }
  const handoff = text(i.handoff, 2000);
  if (handoff === null) return { ok: false, error: "The hand-off list can be up to 2,000 characters." };
  const maxPerChat = int(i.maxPerChat, 1, 100);
  if (maxPerChat === null) return { ok: false, error: "Replies per chat must be between 1 and 100." };
  const maxPerMonth = int(i.maxPerMonth, 1, 100000);
  if (maxPerMonth === null) return { ok: false, error: "Replies per month must be between 1 and 100,000." };
  const baseUrls = map(i.baseUrls, 300);
  for (const [k, v] of Object.entries(baseUrls)) {
    if (v && !/^https:\/\/[^\s]+$/.test(v) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/[^\s]*)?$/.test(v)) {
      return { ok: false, error: `The address for ${getProvider(k)!.name} must start with https://.` };
    }
  }
  const settings: AiSettings = {
    enabled: i.enabled === true,
    mode: i.mode,
    provider: i.provider,
    models: map(i.models, 200),
    baseUrls,
    effort: i.effort,
    name,
    instructions,
    context,
    siteContext,
    handoff,
    askContact: i.askContact === true,
    matchLanguage: i.matchLanguage === true,
    length: i.length === "medium" ? "medium" : "short",
    notify: i.notify === true,
    maxPerChat,
    maxPerMonth,
  };
  if (settings.enabled) {
    if (!modelFor(settings)) return { ok: false, error: "Choose a model before turning the assistant on." };
    if (getProvider(settings.provider)!.kind === "openai" && !baseUrlFor(settings)) {
      return { ok: false, error: "Enter the service's address before turning the assistant on." };
    }
  }
  return { ok: true, settings };
}

export async function saveAiSettings(s: AiSettings): Promise<void> {
  await setSetting("ai_settings", s);
}
