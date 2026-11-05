import { db } from "@/lib/db";
import { devGuard } from "@/lib/dev-auth";

export const dynamic = "force-dynamic";

/** Kept out of backups: the keys that sign sign-ins and identify the app for notifications. */
const SECRET_SETTINGS = ["session_secret", "vapid_keys"];

/**
 * Everything as one JSON file: people, chats, messages, questions, settings,
 * the email log, and a list of files (the photos themselves stay out to
 * keep the file small).
 */
export async function GET(req: Request) {
  const denied = await devGuard(req);
  if (denied) return denied;
  const [visitors, conversations, messages, questions, settings, files, emails] = await Promise.all([
    db()`
      select id, name, email, phone, first_site, created_at, last_seen_at, current_site, current_url, current_title,
             referrer, ip, country, region, city, user_agent
      from visitors order by created_at`,
    db()`select * from conversations order by created_at`,
    db()`select id::text, conversation_id, sender, body, attachment_id, created_at from messages order by id`,
    db()`select * from prechat_fields order by position`,
    db()`select key, value from settings where not (key = any(${SECRET_SETTINGS})) order by key`,
    db()`select id, conversation_id, name, type, size, width, height, created_at from attachments order by created_at`,
    db()`select * from email_log order by created_at`,
  ]);
  const body = JSON.stringify(
    {
      app: "MW Chat",
      exportedAt: new Date().toISOString(),
      counts: { people: visitors.length, chats: conversations.length, messages: messages.length, files: files.length },
      visitors,
      conversations,
      messages,
      questions,
      settings,
      files,
      emails,
    },
    null,
    1,
  );
  const day = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="mw-chat-backup-${day}.json"`,
      "cache-control": "no-store",
    },
  });
}
