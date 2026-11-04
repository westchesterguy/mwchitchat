import { after } from "next/server";
import { addMessage, MESSAGE_MAX } from "@/lib/chat";
import { db } from "@/lib/db";
import { isSameOrigin, jsonError, overLimit } from "@/lib/guard";
import { notifyAgent } from "@/lib/push";
import { readJson, str } from "@/lib/request";
import { sites, type SiteId } from "@/lib/sites";
import { findVisitor, touchVisitor, visitorToken } from "@/lib/visitor";

/** The visitor sends a message in their open chat. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return jsonError(403, "forbidden");
  if (overLimit(req, "message", 60, 10 * 60_000)) return jsonError(429, "rate_limited");

  const token = visitorToken(req);
  const body = await readJson(req);
  const text = str(body?.body, MESSAGE_MAX);
  if (!token || !text) return jsonError(400, "bad_request");

  const visitor = await findVisitor(token);
  if (!visitor?.conversationId || visitor.status !== "open") return jsonError(409, "no_open_chat");

  const message = await addMessage(visitor.conversationId, "visitor", text);
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
        body: text,
        url: `/admin/c/${visitor.conversationId}`,
        tag: visitor.conversationId!,
      }),
    );
  }

  return Response.json({ message });
}
