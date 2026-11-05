import { DEV_HOURS, devConfigured, devCookie, devPasswordMatches, newDevSession } from "@/lib/dev-auth";
import { isSameOrigin, jsonError, overLimit } from "@/lib/guard";
import { readJson, str } from "@/lib/request";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return jsonError(403, "forbidden");
  if (overLimit(req, "dev-login", 8, 15 * 60_000)) return jsonError(429, "rate_limited");
  if (!devConfigured()) return jsonError(503, "not_configured");
  if (!devPasswordMatches(str((await readJson(req))?.password, 200))) return jsonError(401, "wrong_password");
  const res = Response.json({ ok: true });
  res.headers.append("set-cookie", devCookie(req, (await newDevSession())!, DEV_HOURS * 3600));
  return res;
}
