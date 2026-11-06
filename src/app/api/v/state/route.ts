import { adminLink, afterParam, messagesAfter } from "@/lib/chat";
import { getSetting } from "@/lib/db";
import { jsonError, overLimit } from "@/lib/guard";
import { rescueIfWaiting } from "@/lib/rescue";
import { findVisitor, touchVisitor, visitorToken } from "@/lib/visitor";

export const dynamic = "force-dynamic";

/**
 * Polled by the open chat window: new messages since `after`, whether the
 * chat is still open, and whether Michael is online.
 */
export async function GET(req: Request) {
  if (overLimit(req, "state", 600, 10 * 60_000)) return jsonError(429, "rate_limited");
  const token = visitorToken(req);
  if (!token) return jsonError(400, "bad_request");

  const [visitor, online] = await Promise.all([
    findVisitor(token),
    getSetting<boolean>("agent_online", true),
  ]);
  if (!visitor?.conversationId) {
    return Response.json({ conversation: null, messages: [], online }, noStore);
  }

  await touchVisitor(visitor.visitorId);
  // Waiting too long for a reply? The rescue message arrives in this poll.
  if (visitor.status === "open") await rescueIfWaiting(visitor.conversationId, adminLink(req, ""));
  return Response.json(
    {
      conversation: { id: visitor.conversationId, status: visitor.status },
      messages: await messagesAfter(visitor.conversationId, afterParam(req)),
      online,
    },
    noStore,
  );
}

const noStore = { headers: { "cache-control": "no-store" } };
