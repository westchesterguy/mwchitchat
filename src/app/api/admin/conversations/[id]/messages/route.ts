import { after } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { addMessage, adminLink, MESSAGE_MAX } from "@/lib/chat";
import { db } from "@/lib/db";
import { readMessageForm, type Upload } from "@/lib/files";
import { jsonError, UUID } from "@/lib/guard";
import { emailRepliesIfGone } from "@/lib/rescue";
import { readJson, str } from "@/lib/request";

/** Room for the half-minute wait before a reply is emailed to a visitor who left. */
export const maxDuration = 60;

/**
 * Michael replies: JSON for text, or a form when a photo or PDF is
 * attached. Replying reopens a chat the visitor had ended.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return jsonError(404, "not_found");

  let text: string;
  let file: Upload | null = null;
  if (req.headers.get("content-type")?.startsWith("multipart/form-data")) {
    const form = await readMessageForm(req);
    if (!form.ok) return Response.json({ error: "invalid", message: form.error }, { status: 400 });
    text = str(form.text, MESSAGE_MAX);
    file = form.file;
  } else {
    text = str((await readJson(req))?.body, MESSAGE_MAX);
  }
  if (!text && !file) return jsonError(400, "bad_request");

  const [found] = await db()`
    update conversations set status = 'open', closed_at = null, agent_last_read_at = now()
    where id = ${id} returning id`;
  if (!found) return jsonError(404, "not_found");

  const message = await addMessage(id, "agent", text, file);
  const base = adminLink(req, "");
  after(() => emailRepliesIfGone(id, message.id, base));
  return Response.json({ message });
}
