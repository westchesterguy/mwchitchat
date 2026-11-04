import { adminGuard } from "@/lib/admin-auth";
import { addMessage, MESSAGE_MAX } from "@/lib/chat";
import { db } from "@/lib/db";
import { jsonError, UUID } from "@/lib/guard";
import { readJson, str } from "@/lib/request";

/** Michael replies. Replying reopens a chat the visitor had ended. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return jsonError(404, "not_found");

  const text = str((await readJson(req))?.body, MESSAGE_MAX);
  if (!text) return jsonError(400, "bad_request");

  const [found] = await db()`
    update conversations set status = 'open', closed_at = null, agent_last_read_at = now()
    where id = ${id} returning id`;
  if (!found) return jsonError(404, "not_found");

  return Response.json({ message: await addMessage(id, "agent", text) });
}
