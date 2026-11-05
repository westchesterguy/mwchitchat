import { devCookie } from "@/lib/dev-auth";
import { isSameOrigin, jsonError } from "@/lib/guard";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return jsonError(403, "forbidden");
  const res = Response.json({ ok: true });
  res.headers.append("set-cookie", devCookie(req, "", 0));
  return res;
}
