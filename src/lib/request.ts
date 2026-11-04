/**
 * Who is asking: IP address and approximate location.
 *
 * Vercel adds the x-vercel-ip-* headers to every request from its own IP
 * geolocation. City and region come URL-encoded. Locally none are present,
 * and every field is simply null.
 */
export interface Origin {
  ip: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  userAgent: string | null;
}

function header(req: Request, name: string, max = 200): string | null {
  const raw = req.headers.get(name);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw).slice(0, max);
  } catch {
    return raw.slice(0, max);
  }
}

export function requestOrigin(req: Request): Origin {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: (forwarded || req.headers.get("x-real-ip") || null)?.slice(0, 64) ?? null,
    country: header(req, "x-vercel-ip-country", 8),
    region: header(req, "x-vercel-ip-country-region", 16),
    city: header(req, "x-vercel-ip-city", 120),
    userAgent: header(req, "user-agent", 400),
  };
}

/** A string field from a parsed JSON body, trimmed and capped. */
export function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** An absolute http(s) URL, or null. Pages report their own location. */
export function pageUrl(value: unknown): string | null {
  const s = str(value, 1_000);
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}
