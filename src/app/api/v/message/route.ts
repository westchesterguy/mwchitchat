import { after } from "next/server";
import { addMessage, MESSAGE_MAX } from "@/lib/chat";
import { db } from "@/lib/db";
import { attachmentLabel, readMessageForm, type Upload } from "@/lib/files";
import { isSameOrigin, jsonError, overLimit } from "@/lib/guard";
import { notifyAgent } from "@/lib/push";
import { readJson, str } from "@/lib/request";
import { sites, type SiteId } from "@/lib/sites";
import { findVisitor, touchVisitor, visitorToken } from "@/lib/visitor";

/** Photos and PDFs a visitor may send in one chat. */
const FILES_PER_CHAT = 30;

/**
 * The visitor sends a message in their open chat: JSON for text, or a form
 * when a photo or PDF is attached.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return jsonError(403, "forbidden");
  if (overLimit(req, "message", 60, 10 * 60_000)) return jsonError(429, "rate_limited");

  const token = visitorToken(req);
  if (!token) return jsonError(400, "bad_request");

  let text: string;
  let file: Upload | null = null;
  if (req.headers.get("content-type")?.startsWith("multipart/form-data")) {
    if (overLimit(req, "upload", 20, 60 * 60_000)) return jsonError(429, "rate_limited");
    const form = await readMessageForm(req);
    if (!form.ok) return Response.json({ error: "invalid", message: form.error }, { status: 400 });
    text = str(form.text, MESSAGE_MAX);
    file = form.file;
  } else {
    text = str((await readJson(req))?.body, MESSAGE_MAX);
  }
  if (!text && !file) return jsonError(400, "bad_request");

  const visitor = await findVisitor(token);
  if (!visitor?.conversationId || visitor.status !== "open") return jsonError(409, "no_open_chat");

  if (file) {
    const [{ n }] = await db()`
      select count(*)::int as n from messages
      where conversation_id = ${visitor.conversationId} and sender = 'visitor' and attachment_id is not null`;
    if (n >= FILES_PER_CHAT) {
      return Response.json({ error: "invalid", message: "This chat has reached its limit for attachments." }, { status: 400 });
    }
  }

  const message = await addMessage(visitor.conversationId, "visitor", text, file);
  await touchVisitor(visitor.visitorId);

  // Michael is told unless he has had this chat open in the last half minute.
  const [c] = await db()`
    select v.name,
           c.agent_last_read_at is null
             or c.agent_last_read_at < now() - interval '30 seconds' as notify
    from conversations c join visitors v on v.id = c.visitor_id
    where c.id = ${visitor.conversationId}`;
  if (c?.notify) {
    const domain = sites[visitor.site as SiteId]?.domain ?? visitor.site;
    after(() =>
      notifyAgent({
        title: `${c.name ?? "Visitor"} (${domain})`,
        body: text || `Sent a ${attachmentLabel(file?.type).toLowerCase()}`,
        url: `/admin/c/${visitor.conversationId}`,
        tag: visitor.conversationId!,
      }),
    );
  }

  return Response.json({ message });
}
