import { adminGuard } from "@/lib/admin-auth";
import { getChatSettings } from "@/lib/chat-settings";
import { db } from "@/lib/db";

let lastSweep = 0;

/** Closes chats with no messages for the number of days set on the developer page. */
async function autoClose() {
  if (Date.now() - lastSweep < 10 * 60_000) return;
  lastSweep = Date.now();
  const { autoCloseDays } = await getChatSettings();
  if (autoCloseDays <= 0) return;
  await db()`
    update conversations set status = 'closed', closed_at = now()
    where status = 'open' and last_message_at < now() - make_interval(days => ${autoCloseDays})`;
}

export const dynamic = "force-dynamic";

/** The inbox: every chat, open and closed together, newest activity first (?status= narrows it). */
export async function GET(req: Request) {
  const denied = await adminGuard(req);
  if (denied) return denied;

  await autoClose();
  const asked = new URL(req.url).searchParams.get("status");
  const status = asked === "open" || asked === "closed" ? asked : null;
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
      case
        when lm.body = '' and lm.file_type = 'application/pdf' then 'PDF'
        when lm.body = '' and lm.file_type is not null then 'Photo'
        when lm.body = '' then 'Attachment removed'
        else lm.body
      end as preview,
      lm.sender as last_sender,
      lm.ai as last_ai
    from conversations c
    join visitors v on v.id = c.visitor_id
    left join lateral (
      select m.body, m.sender, m.ai, a.type as file_type from messages m
      left join attachments a on a.id = m.attachment_id
      where m.conversation_id = c.id and m.sender <> 'system'
      order by m.id desc limit 1
    ) lm on true
    where (${status}::text is null or c.status = ${status})
    order by c.last_message_at desc
    limit 200`;

  return Response.json(
    { conversations: rows },
    { headers: { "cache-control": "no-store" } },
  );
}
