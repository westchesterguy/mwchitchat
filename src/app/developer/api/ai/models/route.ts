import { claudeModels } from "@/lib/ai/claude";
import { openAiStyleModels } from "@/lib/ai/openai-style";
import { getProvider, providerKey } from "@/lib/ai/providers";
import { devGuard } from "@/lib/dev-auth";

export const dynamic = "force-dynamic";

/** The models a service offers right now, read with its key. */
export async function GET(req: Request) {
  const denied = await devGuard(req);
  if (denied) return denied;
  const params = new URL(req.url).searchParams;
  const provider = getProvider(params.get("provider") ?? "");
  if (!provider) return Response.json({ error: "Unknown service." }, { status: 400 });
  const key = providerKey(provider);
  if (!key) return Response.json({ error: `Add ${provider.keys[0]} in Vercel first, then redeploy.` }, { status: 400 });
  const base = (params.get("base") || provider.baseUrl || "").replace(/\/+$/, "");
  if (provider.kind === "openai" && !/^https:\/\//.test(base) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(base)) {
    return Response.json({ error: "Enter the service's https:// address first." }, { status: 400 });
  }
  try {
    const models = provider.kind === "anthropic" ? await claudeModels(key) : await openAiStyleModels(base, key);
    return Response.json({ models });
  } catch {
    return Response.json({ error: `${provider.name} didn't return its model list. Type the model name instead.` }, { status: 502 });
  }
}
