import { PROVIDERS, providerKey } from "@/lib/ai/providers";
import { AI_DEFAULTS, checkAiSettings, getAiSettings, saveAiSettings } from "@/lib/ai/settings";
import { db } from "@/lib/db";
import { devGuard } from "@/lib/dev-auth";
import { readJson } from "@/lib/request";
import { sites } from "@/lib/sites";

export const dynamic = "force-dynamic";

/** The AI integration tab: settings, the services and whether each key is set, and recent use. */
export async function GET(req: Request) {
  const denied = await devGuard(req);
  if (denied) return denied;
  const [settings, [usage], log] = await Promise.all([
    getAiSettings(),
    db()`
      select count(*) filter (where purpose = 'reply' and ok)::int as replies,
             count(*) filter (where purpose = 'draft' and ok)::int as drafts,
             count(*) filter (where not ok)::int as failed
      from ai_log where created_at >= date_trunc('month', now())`,
    db()`
      select id, conversation_id, purpose, provider, model, ok, error, ms, input_tokens, output_tokens, created_at
      from ai_log order by created_at desc limit 20`,
  ]);
  return Response.json(
    {
      settings,
      defaults: AI_DEFAULTS,
      providers: PROVIDERS.map((p) => ({ ...p, keySet: Boolean(providerKey(p)) })),
      sites: Object.values(sites).map((s) => ({ id: s.id, domain: s.domain })),
      usage,
      log,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function PUT(req: Request) {
  const denied = await devGuard(req);
  if (denied) return denied;
  const result = checkAiSettings((await readJson(req))?.settings);
  if (!result.ok) return Response.json({ error: "invalid", message: result.error }, { status: 400 });
  await saveAiSettings(result.settings);
  return Response.json({ settings: result.settings });
}
