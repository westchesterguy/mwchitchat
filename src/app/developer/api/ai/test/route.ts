import { generate } from "@/lib/ai/assistant";
import { checkAiSettings } from "@/lib/ai/settings";
import { devGuard } from "@/lib/dev-auth";
import { getSetting } from "@/lib/db";
import { overLimit } from "@/lib/guard";
import { readJson, str } from "@/lib/request";
import { getSite } from "@/lib/sites";

export const maxDuration = 60;

/**
 * Asks the chosen service one question with the settings on screen (saved
 * or not), as if a visitor on the chosen site had written it. Works with the
 * assistant off, and touches no real chat.
 */
export async function POST(req: Request) {
  const denied = await devGuard(req);
  if (denied) return denied;
  if (overLimit(req, "ai-test", 30, 60 * 60_000)) {
    return Response.json({ ok: false, error: "Too many tests this hour. Try again later." }, { status: 429 });
  }
  const body = await readJson(req);
  const checked = checkAiSettings({ ...(body?.settings as object), enabled: false });
  if (!checked.ok) return Response.json({ ok: false, error: checked.error }, { status: 400 });
  const question = str(body?.question, 1000);
  if (!question) return Response.json({ ok: false, error: "Type a question to test with." }, { status: 400 });
  const site = getSite(body?.site) ?? getSite("westchesterguy")!;
  const r = await generate(
    checked.settings,
    {
      site: site.id,
      page: { url: `${site.origin}/`, title: site.domain },
      visitor: { name: "Test Visitor", email: null, phone: null },
      answers: [],
      online: await getSetting<boolean>("agent_online", true),
    },
    [{ role: "user", content: question }],
    "test",
  );
  return Response.json(r);
}
