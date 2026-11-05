import { db } from "@/lib/db";
import { devGuard } from "@/lib/dev-auth";
import { jsonError } from "@/lib/guard";
import { readJson } from "@/lib/request";

export const dynamic = "force-dynamic";

function months(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 60 ? n : null;
}

/** How many photos and PDFs are older than N months, and their size. */
export async function GET(req: Request) {
  const denied = await devGuard(req);
  if (denied) return denied;
  const m = months(new URL(req.url).searchParams.get("months"));
  if (!m) return jsonError(400, "bad_request");
  const [r] = await db()`
    select count(*)::int as count, coalesce(sum(size), 0)::bigint as bytes
    from attachments where created_at < now() - make_interval(months => ${m})`;
  return Response.json({ months: m, count: r.count, bytes: Number(r.bytes) }, { headers: { "cache-control": "no-store" } });
}

/** Deletes them; their messages stay, marked "Attachment removed". */
export async function POST(req: Request) {
  const denied = await devGuard(req);
  if (denied) return denied;
  const m = months((await readJson(req))?.months);
  if (!m) return jsonError(400, "bad_request");
  const [r] = await db()`
    with gone as (
      delete from attachments where created_at < now() - make_interval(months => ${m}) returning size
    )
    select count(*)::int as count, coalesce(sum(size), 0)::bigint as bytes from gone`;
  return Response.json({ months: m, count: r.count, bytes: Number(r.bytes) });
}
