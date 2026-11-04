import { adminGuard } from "@/lib/admin-auth";
import { getSetting, setSetting } from "@/lib/db";
import { jsonError } from "@/lib/guard";
import {
  EMAIL,
  emailConfigured,
  leadEmailMode,
  leadRecipients,
  MAX_RECIPIENTS,
  senderAddress,
  type LeadEmailMode,
} from "@/lib/mail";
import { readJson } from "@/lib/request";
import { getVapidKeys } from "@/lib/secrets";

export const dynamic = "force-dynamic";

async function emailSettings() {
  return {
    configured: emailConfigured(),
    from: senderAddress(),
    recipients: await leadRecipients(),
    mode: await leadEmailMode(),
    max: MAX_RECIPIENTS,
  };
}

export async function GET(req: Request) {
  const denied = await adminGuard(req);
  if (denied) return denied;
  return Response.json(
    {
      online: await getSetting<boolean>("agent_online", true),
      push: { configured: true, publicKey: (await getVapidKeys()).publicKey },
      email: await emailSettings(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * Any of: online or away; the addresses lead emails go to; whether every
 * new lead is emailed or only those that arrive while Michael is away.
 */
export async function PUT(req: Request) {
  const denied = await adminGuard(req);
  if (denied) return denied;
  const body = await readJson(req);
  if (!body) return jsonError(400, "bad_request");
  const { online, leadEmails, leadEmailMode: mode } = body;

  if (online !== undefined && typeof online !== "boolean") return jsonError(400, "bad_request");
  if (mode !== undefined && mode !== "every" && mode !== "away") return jsonError(400, "bad_request");

  let emails: string[] | undefined;
  if (leadEmails !== undefined) {
    if (!Array.isArray(leadEmails) || leadEmails.some((e) => typeof e !== "string")) return jsonError(400, "bad_request");
    emails = [...new Set((leadEmails as string[]).map((e) => e.trim().toLowerCase()).filter(Boolean))];
    const bad = emails.find((e) => e.length > 254 || !EMAIL.test(e));
    if (bad) return Response.json({ error: "invalid", message: `"${bad}" is not a valid email address.` }, { status: 400 });
    if (emails.length > MAX_RECIPIENTS) {
      return Response.json({ error: "invalid", message: `Up to ${MAX_RECIPIENTS} addresses.` }, { status: 400 });
    }
  }

  if (online !== undefined) await setSetting("agent_online", online);
  if (emails !== undefined) await setSetting("lead_emails", emails);
  if (mode !== undefined) await setSetting("lead_email_mode", mode as LeadEmailMode);

  return Response.json({
    online: await getSetting<boolean>("agent_online", true),
    email: await emailSettings(),
  });
}
