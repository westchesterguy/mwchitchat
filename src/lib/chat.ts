import { db } from "./db";
import type { Upload } from "./files";

export type Sender = "visitor" | "agent" | "system";

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  width: number | null;
  height: number | null;
  url: string;
}

export interface ChatMessage {
  id: number;
  sender: Sender;
  body: string;
  at: string;
  attachment: Attachment | null;
  /** Written by the AI assistant rather than Michael. */
  ai: boolean;
}

function toMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: Number(row.id),
    sender: row.sender as Sender,
    body: row.body as string,
    at: new Date(row.created_at as string).toISOString(),
    ai: row.ai === true,
    attachment: row.file_id
      ? {
          id: row.file_id as string,
          name: row.file_name as string,
          type: row.file_type as string,
          size: Number(row.file_size),
          width: (row.file_width as number | null) ?? null,
          height: (row.file_height as number | null) ?? null,
          url: `/api/files/${row.file_id}`,
        }
      : null,
  };
}

export const MESSAGE_MAX = 2_000;

export async function addMessage(
  conversationId: string,
  sender: Sender,
  body: string,
  file: Upload | null = null,
  ai = false,
): Promise<ChatMessage> {
  if (!file) {
    const [row] = await db()`
      with m as (
        insert into messages (conversation_id, sender, body, ai)
        values (${conversationId}, ${sender}, ${body}, ${ai})
        returning id::text, sender, body, created_at, ai
      ), c as (
        update conversations set last_message_at = now()
        where id = ${conversationId}
      )
      select * from m`;
    return toMessage(row);
  }
  // The file and its message are saved in one statement: both or neither.
  const [row] = await db()`
    with a as (
      insert into attachments (conversation_id, name, type, size, width, height, data)
      values (${conversationId}, ${file.name}, ${file.type}, ${file.data.length}, ${file.width}, ${file.height}, ${file.data})
      returning id, name, type, size, width, height
    ), m as (
      insert into messages (conversation_id, sender, body, attachment_id)
      select ${conversationId}::uuid, ${sender}, ${body}, a.id from a
      returning id::text, sender, body, created_at, ai
    ), c as (
      update conversations set last_message_at = now()
      where id = ${conversationId}
    )
    select m.*, a.id as file_id, a.name as file_name, a.type as file_type, a.size as file_size,
           a.width as file_width, a.height as file_height
    from m, a`;
  return toMessage(row);
}

export async function messagesAfter(conversationId: string, after: number): Promise<ChatMessage[]> {
  const rows = await db()`
    select m.id::text, m.sender, m.body, m.created_at, m.ai,
           a.id as file_id, a.name as file_name, a.type as file_type, a.size as file_size,
           a.width as file_width, a.height as file_height
    from messages m
    left join attachments a on a.id = m.attachment_id
    where m.conversation_id = ${conversationId} and m.id > ${after}
    order by m.id
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
