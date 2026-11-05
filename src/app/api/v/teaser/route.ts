import { allowedOrigin, corsHeaders } from "@/lib/cors";
import { widgetConfig } from "@/lib/greeting";
import { jsonError } from "@/lib/guard";
import { getSite } from "@/lib/sites";

export const dynamic = "force-dynamic";

/**
 * The greeting alone, for copies of widget.js loaded before /api/v/widget
 * existed (browsers keep it up to five minutes). An empty text shows nothing.
 */
export async function GET(req: Request) {
  const headers = corsHeaders(allowedOrigin(req));
  const params = new URL(req.url).searchParams;
  const site = getSite(params.get("site"));
  if (!site) return jsonError(400, "bad_request", headers);
  const { greeting } = await widgetConfig(site.id, params.get("path") ?? "/");
  return Response.json(greeting ?? { text: "" }, { headers: { ...headers, "cache-control": "no-store" } });
}
