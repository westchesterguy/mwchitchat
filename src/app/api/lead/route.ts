import { Resend } from "resend";
import { isSameOrigin, overLimit, parseTurns } from "@/lib/guard";
import { SMS_CONSENT_TEXT } from "@/lib/shared";
import { contact, getSite } from "@/lib/sites";

export const runtime = "nodejs";

/**
 * Same sender and inbox the sites' contact forms use. The sender's domain must
 * be verified in Resend for mail to leave at all, so change LEAD_FROM only
 * after the new domain is verified there.
 */
const FROM = process.env.LEAD_FROM ?? "Michael Winter <contact@michaelwinterrealestate.com>";
const TO = process.env.LEAD_TO ?? "michael.winter@juliabfee.com";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function field(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ ok: false }, { status: 403 });
  if (overLimit(req, "lead", 5, 60 * 60_000)) {
    return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  // Honeypot: people never see this field, form-filling bots do. Report
  // success so the bot has nothing to learn from.
  if (field(body.website, 200)) return Response.json({ ok: true });

  const site = getSite(body.site);
  const name = field(body.name, 120);
  const email = field(body.email, 200);
  const phone = field(body.phone, 40);
  const note = field(body.note, 1_000);
  const consent = body.consent === true;
  const transcript = parseTurns(body.transcript) ?? [];

  if (!site || !name || !EMAIL.test(email)) {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  if (!process.env.RESEND_API_KEY) {
    console.error(JSON.stringify({ leadError: "RESEND_API_KEY is not set" }));
    return Response.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const submittedAt = new Date().toISOString();
  const conversation = transcript.length
    ? transcript
        .map((t) => `${t.role === "user" ? "Visitor" : "Assistant"}: ${t.content}`)
        .join("\n\n")
    : "(no messages before the form)";

  const text = `New lead from the chat on ${site.domain}

Name: ${name}
Email: ${email}
Phone: ${phone || "(not provided)"}

What they want:
${note || "(not given)"}

-- SMS consent record --
Consent given: ${consent ? "Yes" : "No"}
Consent text shown: ${SMS_CONSENT_TEXT}
Submitted at: ${submittedAt}

-- Conversation --
${conversation}
`;

  // Resend reports failures in its result rather than by throwing, so the
  // error has to be read; a lead that silently fails to send is lost.
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: FROM,
    to: TO,
    replyTo: email,
    subject: `[Chat] ${site.domain}: ${name}`,
    text,
  });

  if (error) {
    console.error(JSON.stringify({ leadError: error.name, site: site.id }));
    return Response.json(
      { ok: false, error: "send_failed", phone: contact.phoneDisplay },
      { status: 502 },
    );
  }
  return Response.json({ ok: true });
}
