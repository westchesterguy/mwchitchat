import { adminGuard } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/guard";
import { readJson, str } from "@/lib/request";

/** Turns notifications on for the device Michael is using. */
export async function POST(req: Request) {
  const denied = await adminGuard(req);
  if (denied) return denied;

  const sub = (await readJson(req))?.subscription as
    | { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
    | undefined;
  const endpoint = str(sub?.endpoint, 1_000);
  const p256dh = str(sub?.keys?.p256dh, 200);
  const auth = str(sub?.keys?.auth, 100);
  if (!endpoint.startsWith("https://") || !p256dh || !auth) return jsonError(400, "bad_request");

  await db()`
    insert into push_subscriptions (endpoint, p256dh, auth, user_agent)
    values (${endpoint}, ${p256dh}, ${auth}, ${str(req.headers.get("user-agent"), 400) || null})
    on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth`;
  return Response.json({ ok: true });
}

/** Turns them off for that device. */
export async function DELETE(req: Request) {
  const denied = await adminGuard(req);
  if (denied) return denied;
  const endpoint = str((await readJson(req))?.endpoint, 1_000);
  if (endpoint) await db()`delete from push_subscriptions where endpoint = ${endpoint}`;
  return Response.json({ ok: true });
}
