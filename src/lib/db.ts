import postgres, { type Sql } from "postgres";
import { connectionOptions } from "../../scripts/db-url.mjs";

declare global {
  var __mwchatSql: Sql | undefined;
}

/**
 * The one database client, shared across requests in the same instance.
 *
 * POSTGRES_URL is Supabase's pooled connection (transaction mode), which
 * cannot hold named prepared statements, hence `prepare: false`.
 */
export function db(): Sql {
  if (!globalThis.__mwchatSql) {
    const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
    if (!url) throw new Error("POSTGRES_URL is not set");
    globalThis.__mwchatSql = postgres({
      ...connectionOptions(url),
      prepare: false,
      max: 5,
      idle_timeout: 20,
      onnotice: false,
    });
  }
  return globalThis.__mwchatSql;
}

export function dbConfigured(): boolean {
  return Boolean(process.env.POSTGRES_URL ?? process.env.DATABASE_URL);
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const [row] = await db()`select value from settings where key = ${key}`;
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db()`
    insert into settings (key, value) values (${key}, ${db().json(value as never)})
    on conflict (key) do update set value = excluded.value`;
}
