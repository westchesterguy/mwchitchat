/**
 * The websites this chat runs on.
 *
 * Contact facts are copied from the sites' own code (their lib/site.ts), not
 * written fresh: visitors see them, so they have to match what each site
 * already publishes. Change them there first.
 */

export type SiteId = "westchesterguy" | "horse";

export interface Site {
  id: SiteId;
  /** The domain, as the visitor and the admin see it. */
  domain: string;
  /** Origin used for links back into the site. */
  origin: string;
}

/** Shared contact facts. Same on both sites. */
export const contact = {
  name: "Michael Winter",
  phone: "+19145253378",
  phoneDisplay: "+1 (914) 525-3378",
} as const;

/** Both sites link their legal pages to the hub. */
const HUB = "https://westchesterguy.com";

export const legal = {
  privacy: `${HUB}/privacy`,
  terms: `${HUB}/tos`,
} as const;

export const sites: Record<SiteId, Site> = {
  westchesterguy: {
    id: "westchesterguy",
    domain: "westchesterguy.com",
    origin: HUB,
  },
  horse: {
    id: "horse",
    domain: "westchesterhorseproperties.com",
    origin: "https://www.westchesterhorseproperties.com",
  },
};

export function getSite(id: unknown): Site | null {
  return typeof id === "string" && id in sites ? sites[id as SiteId] : null;
}

/**
 * Pages allowed to frame the chat. Previews on vercel.app are included so
 * the chat-test branches can embed it; tighten once it is live.
 */
export const DEFAULT_FRAME_ANCESTORS = [
  "https://westchesterguy.com",
  "https://*.westchesterguy.com",
  "https://michaelwinterrealestate.com",
  "https://*.michaelwinterrealestate.com",
  "https://westchesterhorseproperties.com",
  "https://*.westchesterhorseproperties.com",
  "https://*.vercel.app",
  "http://localhost:*",
];

/** The MW mark, served from the hub rather than copied into this repo. */
export const MARK_URL = `${HUB}/images/mw-lockup-white-v2.png`;
