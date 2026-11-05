import { db } from "@/lib/db";
import { devGuard } from "@/lib/dev-auth";
import { jsonError, UUID } from "@/lib/guard";
import { logError } from "@/lib/log";

/**
 * Deletes everything about one person: their visitor record, chats,
 * messages and files. The lead emails already sent stay in the inboxes they
 * went to; this cannot reach those.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await devGuard(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return jsonError(404, "not_found");
  const [found] = await db()`
    select (select count(*)::int from conversations c where c.visitor_id = v.id) as chats,
           (select count(*)::int from messages m join conversations c on c.id = m.conversation_id where c.visitor_id = v.id) as messages,
           (select count(*)::int from attachments a join conversations c on c.id = a.conversation_id where c.visitor_id = v.id) as files
    from visitors v where v.id = ${id}`;
  if (!found) return jsonError(404, "not_found");
  await db()`delete from visitors where id = ${id}`;
  // A record that it happened, without who it was.
  await logError("data", "A person's data was deleted from the developer page.", found);
  return Response.json({ deleted: found });
}
