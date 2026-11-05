import { CHAT_DEFAULTS, getChatSettings, saveChatSettings } from "@/lib/chat-settings";
import { devGuard } from "@/lib/dev-auth";
import { readJson } from "@/lib/request";
import { sites } from "@/lib/sites";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await devGuard(req);
  if (denied) return denied;
  return Response.json(
    {
      settings: await getChatSettings(),
      defaults: CHAT_DEFAULTS,
      sites: Object.values(sites).map((s) => ({ id: s.id, domain: s.domain })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function PUT(req: Request) {
  const denied = await devGuard(req);
  if (denied) return denied;
  const result = await saveChatSettings((await readJson(req))?.settings);
  if (!result.ok) return Response.json({ error: "invalid", message: result.error }, { status: 400 });
  return Response.json({ settings: result.settings });
}
