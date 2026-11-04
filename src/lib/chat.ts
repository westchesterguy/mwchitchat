import { db } from "./db";

export type Sender = "visitor" | "agent" | "system";

export interface ChatMessage {
  id: number;
  sender: Sender;
  body: string;
  at: string;
}

function toMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: Number(row.id),
    sender: row.sender as Sender,
    body: row.body as string,
    at: new Date(row.created_at as string).toISOString(),
  };
}

export const MESSAGE_MAX = 2_000;

export async function addMessage(
  conversationId: string,
  sender: Sender,
  body: string,
): Promise<ChatMessage> {
  const [row] = await db()`
    with m as (
      insert into messages (conversation_id, sender, body)
      values (${conversationId}, ${sender}, ${body})
      returning id::text, sender, body, created_at
    ), c as (
      update conversations set last_message_at = now()
      where id = ${conversationId}
    )
    select * from m`;
  return toMessage(row);
}

export async function messagesAfter(conversationId: string, after: number): Promise<ChatMessage[]> {
  const rows = await db()`
    select id::text, sender, body, created_at from messages
    where conversation_id = ${conversationId} and id > ${after}
    order by id
    limit 500`;
  return rows.map(toMessage);
}

/** The `after` query parameter: the last message id the caller already has. */
export function afterParam(req: Request): number {
  const n = Number(new URL(req.url).searchParams.get("after") ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Absolute link into the admin app, for notifications and emails. */
export function adminLink(req: Request, path: string): string {
  const base = process.env.APP_URL ?? new URL(req.url).origin;
  return `${base.replace(/\/$/, "")}${path}`;
}
