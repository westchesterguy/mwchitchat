/**
 * Cheap checks public endpoints run before touching the database.
 */

/**
 * True for requests from this app's own pages (the chat window, the admin
 * app). Browsers send Origin on POSTs; Sec-Fetch-Site covers the rest.
 */
export function isSameOrigin(req: Request): boolean {
  if (req.headers.get("sec-fetch-site") === "same-origin") return true;
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
 * Sliding-window limit per IP. Held in memory, so each server instance counts
 * on its own: it slows a single abuser down, it is not a guarantee. A Vercel
 * Firewall rate-limit rule is the real control once this is live.
 */
export function overLimit(req: Request, name: string, max: number, windowMs: number): boolean {
  const key = `${name}:${clientIp(req)}`;
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) buckets.clear();
  return hits.length > max;
}

export function jsonError(status: number, error: string, headers?: Record<string, string>) {
  return Response.json({ error }, { status, headers });
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
