import {
  adminConfigured,
  newSession,
  passwordMatches,
  SESSION_COOKIE,
  SESSION_DAYS,
} from "@/lib/admin-auth";
import { isSameOrigin, jsonError, overLimit } from "@/lib/guard";
import { readJson, str } from "@/lib/request";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return jsonError(403, "forbidden");
  if (overLimit(req, "login", 10, 15 * 60_000)) return jsonError(429, "rate_limited");
  if (!adminConfigured()) return jsonError(503, "not_configured");

  const body = await readJson(req);
  if (!passwordMatches(str(body?.password, 200))) return jsonError(401, "wrong_password");

  const res = Response.json({ ok: true });
  const cookie = [
    `${SESSION_COOKIE}=${await newSession()}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_DAYS * 86_400}`,
    ...(new URL(req.url).protocol === "https:" ? ["Secure"] : []),
  ].join("; ");
  res.headers.append("set-cookie", cookie);
  return res;
}
