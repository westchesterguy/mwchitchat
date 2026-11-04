import { adminGuard } from "@/lib/admin-auth";
import { addMessage } from "@/lib/chat";
import { db } from "@/lib/db";
import { jsonError, UUID } from "@/lib/guard";
import { readJson } from "@/lib/request";

/** Close a chat, or reopen it. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return jsonError(404, "not_found");

  const status = (await readJson(req))?.status;
  if (status !== "open" && status !== "closed") return jsonError(400, "bad_request");

  const [row] = await db()`
    update conversations set
      status = ${status},
      closed_at = case when ${status} = 'closed' then now() else null end
    where id = ${id} and status <> ${status}
    returning id`;
  if (row && status === "closed") await addMessage(id, "system", "Michael ended the chat.");
  return Response.json({ ok: true, status });
}
