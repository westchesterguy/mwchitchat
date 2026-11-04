// Applies db/migrations/*.sql in name order, once each, before every build.
//
// Runs on Vercel as part of `npm run build`, so a deploy brings its own
// schema with it. Skips quietly when no database is configured (a local
// build, or before Supabase is connected), so the build still passes.

import { readdir, readFile } from "node:fs/promises";
import postgres from "postgres";
import { connectionOptions } from "./db-url.mjs";

const url =
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL;

if (!url) {
  console.log("migrate: no database configured, skipping");
  process.exit(0);
}

const sql = postgres({ ...connectionOptions(url), max: 1, onnotice: false });
const dir = new URL("../db/migrations/", import.meta.url);

try {
  await sql`create table if not exists schema_migrations (
    id text primary key,
    applied_at timestamptz not null default now()
  )`;
  // One build at a time: a preview and a production build can run together.
  await sql`select pg_advisory_lock(73195)`;

  const done = new Set((await sql`select id from schema_migrations`).map((r) => r.id));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (done.has(file)) continue;
    const text = await readFile(new URL(file, dir), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(text);
      await tx`insert into schema_migrations (id) values (${file})`;
    });
    console.log(`migrate: applied ${file}`);
  }
  console.log("migrate: up to date");
} finally {
  await sql.end();
}
