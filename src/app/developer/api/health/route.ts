import { db, getSetting } from "@/lib/db";
import { devGuard, devPasswordIsSeparate } from "@/lib/dev-auth";
import { emailConfigured, leadEmailMode, leadRecipients, senderAddress } from "@/lib/mail";
import { getVapidKeys } from "@/lib/secrets";

export const dynamic = "force-dynamic";

/** Names only, never values. */
const ENV = [
  ["ADMIN_PASSWORD", "Chat app password"],
  ["DEVELOPER_PASSWORD", "Developer page password (uses the admin password when not set)"],
  ["RESEND_API_KEY", "Sends lead emails"],
  ["LEAD_FROM", "Sender for lead emails (a default is used when not set)"],
  ["POSTGRES_URL", "Database"],
  ["APP_URL", "This app's address for links (optional)"],
  ["ALLOWED_ORIGINS", "Sites allowed to use the chat (optional; defaults cover both sites)"],
  ["FRAME_ANCESTORS", "Sites allowed to show the chat window (optional)"],
] as const;

async function check<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T; ms: number } | { ok: false; error: string; ms: number }> {
  const t = performance.now();
  try {
    const value = await fn();
    return { ok: true, value, ms: Math.round(performance.now() - t) };
  } catch (err) {
    return { ok: false, error: (err as Error).message || "Failed", ms: Math.round(performance.now() - t) };
  }
}

export async function GET(req: Request) {
  const denied = await devGuard(req);
  if (denied) return denied;

  const database = await check(async () => {
    const [v] = await db()`select split_part(version(), ' ', 2) as version, pg_database_size(current_database())::bigint as bytes`;
    return { version: v.version as string, bytes: Number(v.bytes) };
  });
  if (!database.ok) {
    return Response.json({ database }, { headers: { "cache-control": "no-store" } });
  }

  const [tables, [counts], migrations, emails, [emailFails], errors, [errors24], [devices], vapid, online, recipients, mode] =
    await Promise.all([
      db()`
        select c.relname as name, pg_total_relation_size(c.oid)::bigint as bytes
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by bytes desc`,
      db()`
        select (select count(*) from visitors)::int as visitors,
               (select count(*) from conversations)::int as chats,
               (select count(*) from conversations where status = 'open')::int as open_chats,
               (select count(*) from messages)::int as messages,
               (select count(*) from attachments)::int as files,
               (select coalesce(sum(size), 0) from attachments)::bigint as file_bytes`,
      db()`select id, applied_at from schema_migrations order by id`,
      db()`
        select id, kind, recipients, subject, ok, error, created_at, conversation_id
        from email_log order by created_at desc limit 15`,
      db()`
        select count(*) filter (where not ok)::int as failed, count(*)::int as total
        from email_log where created_at > now() - interval '30 days'`,
      db()`select id, source, message, detail, created_at from error_log order by created_at desc limit 25`,
      db()`select count(*)::int as n from error_log where created_at > now() - interval '24 hours'`,
      db()`select count(*)::int as n from push_subscriptions`,
      check(async () => Boolean((await getVapidKeys()).publicKey)),
      getSetting<boolean>("agent_online", true),
      leadRecipients(),
      leadEmailMode(),
    ]);

  return Response.json(
    {
      database: { ...database, tables: tables.map((t) => ({ name: t.name, bytes: Number(t.bytes) })) },
      counts: { ...counts, file_bytes: Number(counts.file_bytes) },
      migrations,
      email: {
        configured: emailConfigured(),
        from: senderAddress(),
        recipients,
        mode,
        failed30: emailFails.failed,
        sent30: emailFails.total,
        recent: emails,
      },
      push: { keys: vapid.ok && vapid.value, devices: devices.n },
      errors: { last24h: errors24.n, recent: errors },
      online,
      env: ENV.map(([name, purpose]) => ({ name, purpose, set: Boolean(process.env[name]) })),
      separateDevPassword: devPasswordIsSeparate(),
      version: {
        commit: (process.env.BUILD_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || null,
        message: process.env.BUILD_MESSAGE || null,
        branch: process.env.BUILD_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || null,
        builtAt: process.env.BUILD_TIME || null,
        environment: process.env.VERCEL_ENV ?? "local",
        region: process.env.VERCEL_REGION ?? null,
        node: process.version,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
