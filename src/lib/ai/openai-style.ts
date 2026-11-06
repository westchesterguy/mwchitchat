import type { Answer } from "./claude";
import type { Turn } from "./prompt";

/**
 * Every other service: the OpenAI-style chat API that ChatGPT, Gemini,
 * DeepSeek, Qwen, Mistral, Grok, Kimi, Groq, OpenRouter and the Vercel AI
 * Gateway all accept. No length cap is sent (the services disagree on its
 * name); the instructions keep replies short and the app trims them.
 */
export async function askOpenAiStyle(p: {
  baseUrl: string;
  key: string;
  model: string;
  stable: string;
  chat: string;
  turns: Turn[];
  label: string;
}): Promise<Answer> {
  let res: Response;
  try {
    res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${p.key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: p.model,
        messages: [{ role: "system", content: `${p.stable}\n\n${p.chat}` }, ...p.turns],
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    return { ok: false, error: `${p.label} could not be reached.` };
  }
  const data = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string | { type: string; text?: string }[] } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { message?: string } | string;
  } | null;
  if (!res.ok) {
    const msg = typeof data?.error === "string" ? data.error : data?.error?.message;
    if (res.status === 401 || res.status === 403) return { ok: false, error: `The ${p.label} key was not accepted.` };
    return { ok: false, error: `${p.label} error ${res.status}${msg ? `: ${msg}` : ""}` };
  }
  const content = data?.choices?.[0]?.message?.content;
  const text = (Array.isArray(content) ? content.map((c) => c.text ?? "").join("") : content ?? "").trim();
  if (!text) return { ok: false, error: `${p.label} returned no text.` };
  return { ok: true, text, inputTokens: data?.usage?.prompt_tokens, outputTokens: data?.usage?.completion_tokens };
}

export async function openAiStyleModels(baseUrl: string, key: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/models`, {
    headers: { authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = (await res.json()) as { data?: { id: string }[]; models?: { name?: string; id?: string }[] };
  const list = data.data?.map((m) => m.id) ?? data.models?.map((m) => m.id ?? m.name ?? "") ?? [];
  return list.filter(Boolean).sort();
}
