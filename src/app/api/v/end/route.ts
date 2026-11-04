import { addMessage } from "@/lib/chat";
import { db } from "@/lib/db";
import { isSameOrigin, jsonError } from "@/lib/guard";
import { findVisitor, visitorToken } from "@/lib/visitor";

/** The visitor ends their chat. Michael can still read it in the app. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return jsonError(403, "forbidden");
  const token = visitorToken(req);
  if (!token) return jsonError(400, "bad_request");

  const visitor = await findVisitor(token);
  if (visitor?.conversationId && visitor.status === "open") {
    await addMessage(visitor.conversationId, "system", "The visitor ended the chat.");
    await db()`
      update conversations set status = 'closed', closed_at = now()
      where id = ${visitor.conversationId}`;
  }
  return Response.json({ ok: true });
}
