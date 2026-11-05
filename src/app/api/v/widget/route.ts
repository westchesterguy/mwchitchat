import { allowedOrigin, corsHeaders } from "@/lib/cors";
import { widgetConfig } from "@/lib/greeting";
import { jsonError } from "@/lib/guard";
import { getSite } from "@/lib/sites";

export const dynamic = "force-dynamic";

/** Read by widget.js on each page: show the chat button? and the greeting to show beside it. */
export async function GET(req: Request) {
  const headers = corsHeaders(allowedOrigin(req));
  const params = new URL(req.url).searchParams;
  const site = getSite(params.get("site"));
  if (!site) return jsonError(400, "bad_request", headers);
  return Response.json(await widgetConfig(site.id, params.get("path") ?? "/"), {
    headers: { ...headers, "cache-control": "private, max-age=30" },
  });
}
