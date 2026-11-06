import Anthropic from "@anthropic-ai/sdk";
import type { Effort } from "./settings";
import type { Turn } from "./prompt";

export interface Answer {
  ok: boolean;
  text?: string;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Claude, through Anthropic's SDK. The stable instructions are cached so
 * each reply pays full price only for the chat itself. On models that offer
 * it, a declined answer is retried on Anthropic's recommended fallback model
 * (server-side fallbacks); Haiku has none.
 */
export async function askClaude(p: {
  key: string;
  model: string;
  effort: Effort;
  stable: string;
  chat: string;
  turns: Turn[];
}): Promise<Answer> {
  const client = new Anthropic({ apiKey: p.key, maxRetries: 1, timeout: 45_000 });
  const fallback = /^claude-(opus|sonnet|fable)-/.test(p.model);
  const effort = /^claude-(opus|sonnet|haiku|fable)-5/.test(p.model) || /^claude-opus-4-[5-8]/.test(p.model);
  try {
    const res = await client.beta.messages.create({
      model: p.model,
      max_tokens: 8000,
      system: [
        { type: "text", text: p.stable, cache_control: { type: "ephemeral" } },
        { type: "text", text: p.chat },
      ],
      messages: p.turns.map((t) => ({ role: t.role, content: t.content })),
      ...(effort ? { output_config: { effort: p.effort } } : {}),
      ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    if (res.stop_reason === "refusal") return { ok: false, error: "The model declined to answer this one." };
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    if (!text) return { ok: false, error: "The model returned no text." };
    return { ok: true, text, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, error: "The Anthropic key was not accepted." };
    if (err instanceof Anthropic.NotFoundError) return { ok: false, error: `Anthropic doesn't know the model "${p.model}".` };
    if (err instanceof Anthropic.RateLimitError) return { ok: false, error: "Anthropic's rate limit was reached. Try again shortly." };
    if (err instanceof Anthropic.APIError) return { ok: false, error: `Anthropic error ${err.status ?? ""}: ${err.message}`.trim() };
    return { ok: false, error: "Anthropic could not be reached." };
  }
}

export async function claudeModels(key: string): Promise<string[]> {
  const client = new Anthropic({ apiKey: key, maxRetries: 1, timeout: 20_000 });
  const ids: string[] = [];
  for await (const m of client.models.list()) ids.push(m.id);
  return ids;
}
