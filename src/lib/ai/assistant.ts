import { addMessage, messagesAfter } from "../chat";
import { db, getSetting } from "../db";
import { logError } from "../log";
import { notifyAgent } from "../push";
import { sites, type SiteId } from "../sites";
import { askClaude, type Answer } from "./claude";
import { askOpenAiStyle } from "./openai-style";
import { chatInstructions, stableInstructions, tidy, toTurns, type ChatContext, type Turn } from "./prompt";
import { getProvider, providerKey } from "./providers";
import { baseUrlFor, getAiSettings, modelFor, type AiSettings } from "./settings";

/** Michael writing in a chat makes the assistant step back from it for this long. */
const STEP_BACK_MINUTES = 30;

export interface Result {
  ok: boolean;
  text?: string;
  error?: string;
  ms: number;
  provider: string;
  model: string;
}

/** One call to the chosen service, logged whatever happens. */
export async function generate(
  s: AiSettings,
  ctx: ChatContext,
  turns: Turn[],
  purpose: "reply" | "draft" | "test",
  conversationId: string | null = null,
): Promise<Result> {
  const provider = getProvider(s.provider);
  const model = modelFor(s);
  const started = Date.now();
  let answer: Answer;
  if (!provider) {
    answer = { ok: false, error: "No AI service is chosen." };
  } else if (!model) {
    answer = { ok: false, error: `Choose a ${provider.name} model first.` };
  } else {
    const key = providerKey(provider);
    if (!key) {
      answer = { ok: false, error: `The ${provider.name} key isn't set. Add ${provider.keys[0]} in Vercel, then redeploy.` };
    } else if (provider.kind === "anthropic") {
      answer = await askClaude({ key, model, effort: s.effort, stable: stableInstructions(s, purpose === "draft"), chat: chatInstructions(s, ctx), turns });
    } else {
      const baseUrl = baseUrlFor(s);
      answer = baseUrl
        ? await askOpenAiStyle({ baseUrl, key, model, stable: stableInstructions(s, purpose === "draft"), chat: chatInstructions(s, ctx), turns, label: provider.name })
        : { ok: false, error: `Enter ${provider.name}'s address first.` };
    }
  }
  const ms = Date.now() - started;
  try {
    await db()`
      insert into ai_log (conversation_id, purpose, provider, model, ok, error, ms, input_tokens, output_tokens)
      values (${conversationId}, ${purpose}, ${s.provider}, ${model || "(none)"}, ${answer.ok}, ${answer.error ?? null}, ${ms},
              ${answer.inputTokens ?? null}, ${answer.outputTokens ?? null})`;
  } catch {
    // The answer matters more than its log line.
  }
  if (!answer.ok && purpose !== "test") await logError("ai", answer.error ?? "The AI service failed.", { provider: s.provider, model });
  return { ok: answer.ok, text: answer.ok ? tidy(answer.text!) : undefined, error: answer.error, ms, provider: s.provider, model };
}

/** Everything the assistant needs about one chat, or null if it should stay out of it. */
async function load(conversationId: string) {
  const [c] = await db()`
    select c.id, c.site, c.status, c.start_url, c.start_title, c.prechat, c.ai_paused,
           v.name, v.email, v.phone,
           (select max(m.created_at) from messages m
              where m.conversation_id = c.id and m.sender = 'agent' and not m.ai) as last_human
    from conversations c join visitors v on v.id = c.visitor_id
    where c.id = ${conversationId}`;
  if (!c) return null;
  const online = await getSetting<boolean>("agent_online", true);
  const ctx: ChatContext = {
    site: (c.site as SiteId) in sites ? (c.site as SiteId) : "westchesterguy",
    page: { url: c.start_url as string | null, title: c.start_title as string | null },
    visitor: { name: c.name as string | null, email: c.email as string | null, phone: c.phone as string | null },
    answers: ((c.prechat ?? []) as { label: string; value: string }[]).map((a) => ({ label: a.label, value: a.value })),
    online,
  };
  return { c, ctx };
}

/**
 * Answers the visitor's latest message in a chat, if the assistant is on and
 * allowed to here: not switched off for this chat, Michael hasn't written in
 * it recently, and the per-chat and monthly limits aren't reached. Returns
 * whether it posted a reply.
 */
export async function replyInChat(conversationId: string): Promise<boolean> {
  const s = await getAiSettings();
  if (!s.enabled) return false;
  const loaded = await load(conversationId);
  if (!loaded) return false;
  const { c, ctx } = loaded;
  if (c.status !== "open" || c.ai_paused) return false;
  if (c.last_human && Date.now() - new Date(c.last_human as string).getTime() < STEP_BACK_MINUTES * 60_000) return false;

  const [{ chat, month }] = await db()`
    select (select count(*)::int from messages where conversation_id = ${conversationId} and ai) as chat,
           (select count(*)::int from ai_log where purpose = 'reply' and ok and created_at >= date_trunc('month', now())) as month`;
  if (chat >= s.maxPerChat || month >= s.maxPerMonth) return false;

  const messages = await messagesAfter(conversationId, 0);
  // The latest message that isn't an automatic note (the away or rescue message).
  const last = [...messages].reverse().find((m) => m.sender !== "system");
  if (!last || last.sender !== "visitor") return false;

  const result = await generate(s, ctx, toTurns(messages), "reply", conversationId);
  if (!result.ok || !result.text) return false;

  // Michael may have answered, or the visitor written again, while it thought.
  const [latest] = await db()`
    select id::text, sender from messages
    where conversation_id = ${conversationId} and sender <> 'system'
    order by id desc limit 1`;
  if (!latest || Number(latest.id) !== last.id) return false;

  await addMessage(conversationId, "agent", result.text, null, true);
  if (s.notify) {
    const name = ctx.visitor.name ?? "A visitor";
    await notifyAgent({
      title: `${s.name} replied to ${name}`,
      body: result.text,
      url: `/chatapp/c/${conversationId}`,
      tag: conversationId,
    });
  }
  return true;
}

/** A suggested next message for Michael to edit and send himself. */
export async function draftForChat(conversationId: string): Promise<{ ok: boolean; text?: string; error?: string }> {
  const s = await getAiSettings();
  if (!s.enabled) return { ok: false, error: "The assistant is off. Turn it on in the developer page." };
  const loaded = await load(conversationId);
  if (!loaded) return { ok: false, error: "This chat no longer exists." };
  const turns = toTurns(await messagesAfter(conversationId, 0));
  if (!turns.length) return { ok: false, error: "There is nothing to reply to yet." };
  if (turns[turns.length - 1].role !== "user") {
    turns.push({ role: "user", content: "(No new message from the visitor. Draft Michael's next message to move the conversation forward.)" });
  }
  const r = await generate(s, loaded.ctx, turns, "draft", conversationId);
  return r.ok ? { ok: true, text: r.text } : { ok: false, error: r.error };
}

/** Whether the assistant should answer a visitor's message on its own right now. */
export async function shouldAnswer(online: boolean): Promise<boolean> {
  const s = await getAiSettings();
  return s.enabled && (s.mode === "always" || (s.mode === "cover" && !online));
}
