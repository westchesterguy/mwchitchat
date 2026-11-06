import { adminGuard } from "@/lib/admin-auth";
import { afterParam, messagesAfter } from "@/lib/chat";
import { db } from "@/lib/db";
import { jsonError, UUID } from "@/lib/guard";

export const dynamic = "force-dynamic";

/**
 * One chat with everything known about the visitor. Polled while Michael has
 * it open, which also marks it read.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return jsonError(404, "not_found");

  // "watching=1": the chat is on screen, in focus, with recent taps or
  // typing. Only then do its new messages skip Michael's phone.
  const watching = new URL(req.url).searchParams.get("watching") === "1";
  const [row] = await db()`
    update conversations set
      agent_last_read_at = now(),
      agent_watching_at = case when ${watching} then now() else agent_watching_at end
    where id = ${id}
    returning id, site, status, start_url, start_title, prechat, ip, country, region,
              city, created_at, closed_at, visitor_id, ai_paused`;
  if (!row) return jsonError(404, "not_found");

  const [visitor] = await db()`
    select name, email, phone, first_site, created_at, last_seen_at,
           last_seen_at > now() - interval '75 seconds' as online,
           current_site, current_url, current_title, referrer,
           ip, country, region, city, user_agent,
           (select count(*)::int from conversations where visitor_id = visitors.id) as chats
    from visitors where id = ${row.visitor_id}`;

  const { visitor_id: _, ...conversation } = row;
  return Response.json(
    { conversation, visitor, messages: await messagesAfter(id, afterParam(req)) },
    { headers: { "cache-control": "no-store" } },
  );
}
