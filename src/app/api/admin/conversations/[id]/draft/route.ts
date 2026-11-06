import { adminGuard } from "@/lib/admin-auth";
import { draftForChat } from "@/lib/ai/assistant";
import { jsonError, UUID } from "@/lib/guard";

export const maxDuration = 60;

/** A suggested reply from the AI assistant, for Michael to edit and send. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return jsonError(404, "not_found");
  const r = await draftForChat(id);
  return Response.json(r.ok ? { text: r.text } : { error: "failed", message: r.error }, { status: r.ok ? 200 : 502 });
}
