import { db } from "@/lib/db";
import { devGuard } from "@/lib/dev-auth";

export const dynamic = "force-dynamic";

/** Find a person by name, email or phone, for a privacy request. */
export async function GET(req: Request) {
  const denied = await devGuard(req);
  if (denied) return denied;
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  if (q.length < 2) return Response.json({ people: [] });
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const people = await db()`
    select v.id, v.name, v.email, v.phone, v.first_site, v.created_at, v.last_seen_at, v.city, v.region, v.country,
           (select count(*)::int from conversations c where c.visitor_id = v.id) as chats,
           (select count(*)::int from messages m join conversations c on c.id = m.conversation_id where c.visitor_id = v.id) as messages,
           (select count(*)::int from attachments a join conversations c on c.id = a.conversation_id where c.visitor_id = v.id) as files
    from visitors v
    where v.name ilike ${like} or v.email ilike ${like} or v.phone ilike ${like}
    order by v.last_seen_at desc
    limit 20`;
  return Response.json({ people }, { headers: { "cache-control": "no-store" } });
}
