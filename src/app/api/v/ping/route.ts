import { db } from "@/lib/db";
import { allowedOrigin, corsHeaders } from "@/lib/cors";
import { jsonError, overLimit } from "@/lib/guard";
import { pageUrl, readJson, requestOrigin, str } from "@/lib/request";
import { getSite } from "@/lib/sites";
import { hashToken, visitorToken } from "@/lib/visitor";

/**
 * The widget script on the sites reports the page a visitor is on, so the
 * admin app can show where they are right now. Only visitors who have
 * started a chat are tracked: an unknown token creates nothing.
 */
export async function POST(req: Request) {
  const origin = allowedOrigin(req);
  const headers = corsHeaders(origin);
  if (!origin) return jsonError(403, "forbidden");
  if (overLimit(req, "ping", 120, 10 * 60_000)) return jsonError(429, "rate_limited", headers);

  const token = visitorToken(req);
  const body = await readJson(req);
  const site = getSite(body?.site);
  if (!token || !body || !site) return jsonError(400, "bad_request", headers);

  const where = requestOrigin(req);
  const [row] = await db()`
    update visitors set
      last_seen_at  = now(),
      current_site  = ${site.id},
      current_url   = coalesce(${pageUrl(body.url)}, current_url),
      current_title = coalesce(${str(body.title, 300) || null}, current_title),
      ip            = coalesce(${where.ip}, ip),
      country       = coalesce(${where.country}, country),
      region        = coalesce(${where.region}, region),
      city          = coalesce(${where.city}, city)
    where token_hash = ${hashToken(token)}
    returning (
      select status from conversations
      where visitor_id = visitors.id order by created_at desc limit 1
    ) as status`;

  return Response.json({ active: row?.status === "open" }, { headers });
}

export function OPTIONS(req: Request) {
  const origin = allowedOrigin(req);
  return new Response(null, { status: origin ? 204 : 403, headers: corsHeaders(origin) });
}
