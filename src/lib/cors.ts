import { DEFAULT_FRAME_ANCESTORS } from "./sites";

/**
 * Origins allowed to call the visitor API from the sites' own pages (the
 * widget script reports the page a chatting visitor is on). Same list as the
 * pages allowed to frame the chat; ALLOWED_ORIGINS overrides it.
 */
function patterns(): RegExp[] {
  const list = process.env.ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean)
    ?? DEFAULT_FRAME_ANCESTORS;
  return list.map(
    (p) =>
      new RegExp(
        `^${p
          .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
          .replace(/\\\*|\*/g, "[a-z0-9-]+")}$`,
        "i",
      ),
  );
}

export function allowedOrigin(req: Request): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  return patterns().some((re) => re.test(origin)) ? origin : null;
}

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-mwchat-token",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}
