import { adminGuard } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { jsonError, UUID } from "@/lib/guard";
import { readJson } from "@/lib/request";

/** Turns the AI assistant off (or back on) for one chat. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return jsonError(404, "not_found");
  const paused = (await readJson(req))?.paused;
  if (typeof paused !== "boolean") return jsonError(400, "bad_request");
  const [row] = await db()`update conversations set ai_paused = ${paused} where id = ${id} returning ai_paused`;
  if (!row) return jsonError(404, "not_found");
  return Response.json({ paused: row.ai_paused });
}
