import { Resend } from "resend";
import type { Answer } from "./fields";
import type { Origin } from "./request";

/**
 * Same sender and inbox the sites' contact forms use. The sender's domain
 * must be verified in Resend or no mail leaves at all, so change LEAD_FROM
 * only after a new domain is verified there.
 */
const FROM = process.env.LEAD_FROM ?? "Michael Winter <contact@michaelwinterrealestate.com>";
const TO = process.env.LEAD_TO ?? "michael.winter@juliabfee.com";

interface OfflineLead {
  domain: string;
  answers: Answer[];
  message: string;
  pageUrl: string | null;
  origin: Origin;
  adminUrl: string;
  replyTo: string | null;
}

/**
 * Emails a chat started while Michael is marked offline. Returns false if it
 * could not be sent. Resend reports failures in its result rather than by
 * throwing, so the result is checked; a silent failure would lose the lead.
 */
export async function emailOfflineLead(lead: OfflineLead): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.error(JSON.stringify({ mailError: "RESEND_API_KEY is not set" }));
    return false;
  }
  const name = lead.answers.find((a) => a.key === "name")?.value ?? "A visitor";
  const where = [lead.origin.city, lead.origin.region, lead.origin.country]
    .filter(Boolean)
    .join(", ");

  const text = `New chat on ${lead.domain} while you were offline.

${lead.answers.map((a) => `${a.label}: ${a.value}`).join("\n")}

Message:
${lead.message || "(none)"}

Started on: ${lead.pageUrl ?? "(unknown page)"}
Location: ${where || "(unknown)"}
IP address: ${lead.origin.ip ?? "(unknown)"}
Submitted at: ${new Date().toISOString()}

Reply in the chat app: ${lead.adminUrl}
`;

  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: FROM,
    to: TO,
    ...(lead.replyTo ? { replyTo: lead.replyTo } : {}),
    subject: `[Chat] ${lead.domain}: ${name}`,
    text,
  });
  if (error) {
    console.error(JSON.stringify({ mailError: error.name }));
    return false;
  }
  return true;
}
