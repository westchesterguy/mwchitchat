/**
 * Cheap checks every public endpoint runs before doing anything that costs
 * money or sends mail.
 */

/** The chat page calls the API from its own origin; nothing else should. */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

const buckets = new Map<string, number[]>();

/**
 * Sliding-window limit per IP. Held in memory, so each serverless instance
 * counts on its own: it slows a single abuser down, it is not a guarantee.
 * A Vercel Firewall rate-limit rule is the real control once this is live.
 */
export function overLimit(
  req: Request,
  name: string,
  max: number,
  windowMs: number,
): boolean {
  const key = `${name}:${clientIp(req)}`;
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) buckets.clear();
  return hits.length > max;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export const LIMITS = {
  turns: 40,
  userChars: 2_000,
  assistantChars: 6_000,
  totalChars: 60_000,
} as const;

/** Validates a transcript from the browser. Returns null if it is unusable. */
export function parseTurns(value: unknown): ChatTurn[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (value.length > LIMITS.turns) return null;
  let total = 0;
  const turns: ChatTurn[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const { role, content } = item as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string") return null;
    const text = content.trim();
    if (!text) continue;
    const max = role === "user" ? LIMITS.userChars : LIMITS.assistantChars;
    if (text.length > max) return null;
    total += text.length;
    turns.push({ role, content: text });
  }
  if (total > LIMITS.totalChars) return null;
  return turns.length ? turns : null;
}
