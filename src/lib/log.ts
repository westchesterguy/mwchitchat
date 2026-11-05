import { db, dbConfigured } from "./db";

/**
 * Keeps a record of something that went wrong, for the developer page.
 * Never throws: logging must not break the request it is reporting on.
 * Entries older than 90 days are cleared now and then.
 */
export async function logError(source: string, message: string, detail?: Record<string, unknown>): Promise<void> {
  console.error(JSON.stringify({ source, message: message.slice(0, 300) }));
  if (!dbConfigured()) return;
  try {
    await db()`
      insert into error_log (source, message, detail)
      values (${source}, ${message.slice(0, 1000)}, ${detail ? db().json(detail as never) : null})`;
    if (Math.random() < 0.02) await db()`delete from error_log where created_at < now() - interval '90 days'`;
  } catch {
    // The database itself may be what failed.
  }
}
