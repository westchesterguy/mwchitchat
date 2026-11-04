import { adminGuard } from "@/lib/admin-auth";
import { getSetting, setSetting } from "@/lib/db";
import { jsonError } from "@/lib/guard";
import { readJson } from "@/lib/request";
import { getVapidKeys } from "@/lib/secrets";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await adminGuard(req);
  if (denied) return denied;
  return Response.json(
    {
      online: await getSetting<boolean>("agent_online", true),
      push: { configured: true, publicKey: (await getVapidKeys()).publicKey },
      email: Boolean(process.env.RESEND_API_KEY),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/** Online or away. Away chats are also emailed to Michael. */
export async function PUT(req: Request) {
  const denied = await adminGuard(req);
  if (denied) return denied;
  const online = (await readJson(req))?.online;
  if (typeof online !== "boolean") return jsonError(400, "bad_request");
  await setSetting("agent_online", online);
  return Response.json({ online });
}
