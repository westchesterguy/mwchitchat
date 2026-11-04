import { adminGuard } from "@/lib/admin-auth";
import { jsonError, overLimit } from "@/lib/guard";
import { emailTest, leadRecipients } from "@/lib/mail";

/** Sends a test to the saved addresses and reports Resend's answer. */
export async function POST(req: Request) {
  const denied = await adminGuard(req);
  if (denied) return denied;
  if (overLimit(req, "email-test", 10, 60 * 60_000)) return jsonError(429, "rate_limited");
  const to = await leadRecipients();
  const sent = await emailTest(to);
  return Response.json(sent.ok ? { ok: true, to } : { ok: false, to, message: sent.error }, { status: sent.ok ? 200 : 502 });
}
