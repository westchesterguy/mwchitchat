import { adminGuard } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** The inbox: open chats (or closed ones), newest activity first. */
export async function GET(req: Request) {
  const denied = await adminGuard(req);
  if (denied) return denied;

  const status = new URL(req.url).searchParams.get("status") === "closed" ? "closed" : "open";
  const rows = await db()`
    select
      c.id, c.site, c.status, c.created_at, c.last_message_at,
      v.name, v.email, v.country, v.city,
      v.current_site, v.current_url, v.current_title, v.last_seen_at,
      v.last_seen_at > now() - interval '75 seconds' as online,
      (
        select count(*)::int from messages m
        where m.conversation_id = c.id and m.sender = 'visitor'
          and (c.agent_last_read_at is null or m.created_at > c.agent_last_read_at)
      ) as unread,
      lm.body as preview,
      lm.sender as last_sender
    from conversations c
    join visitors v on v.id = c.visitor_id
    left join lateral (
      select body, sender from messages m
      where m.conversation_id = c.id and m.sender <> 'system'
      order by id desc limit 1
    ) lm on true
    where c.status = ${status}
    order by c.last_message_at desc
    limit 200`;

  return Response.json(
    { conversations: rows },
    { headers: { "cache-control": "no-store" } },
  );
}
