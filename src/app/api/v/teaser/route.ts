import { allowedOrigin, corsHeaders } from "@/lib/cors";
import { getSetting } from "@/lib/db";
import { jsonError } from "@/lib/guard";
import { HEADSHOT_URL, getSite } from "@/lib/sites";

export const dynamic = "force-dynamic";

/** The hub's town pages, /communities/<slug>, that get their own line. */
const TOWNS = new Set([
  "armonk",
  "bedford",
  "bedford-hills",
  "chappaqua",
  "greenwich",
  "katonah",
  "larchmont",
  "mount-kisco",
  "new-canaan",
  "north-salem",
  "pound-ridge",
  "ridgefield",
  "scarsdale",
  "south-salem",
]);

function townName(slug: string): string {
  return slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

/**
 * The greeting the widget shows beside the chat button, matched to the
 * site, the page and whether Michael is online.
 */
function line(site: string, path: string, online: boolean): string {
  if (!online) return "Leave me a message and I'll follow up.";
  if (site === "horse") return "Questions about a farm, barn or acreage? Ask me here.";
  const town = /^\/communities\/([a-z-]+)\/?$/.exec(path)?.[1];
  if (town && TOWNS.has(town)) return `Looking at ${townName(town)}? Ask me anything about the town or a house.`;
  return "Have a question about a house or a town? I'm here.";
}

export async function GET(req: Request) {
  const headers = corsHeaders(allowedOrigin(req));
  const params = new URL(req.url).searchParams;
  const site = getSite(params.get("site"));
  if (!site) return jsonError(400, "bad_request", headers);
  const path = (params.get("path") ?? "/").slice(0, 200).toLowerCase();
  const online = await getSetting<boolean>("agent_online", true);
  return Response.json(
    { online, name: "Michael Winter", photo: HEADSHOT_URL, text: line(site.id, path, online) },
    { headers: { ...headers, "cache-control": "no-store" } },
  );
}
