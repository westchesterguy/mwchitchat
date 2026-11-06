import { Resend } from "resend";
import { db, getSetting } from "./db";
import type { Answer } from "./fields";
import type { Origin } from "./request";

/**
 * The sender must be on a domain verified in Resend or no mail leaves at
 * all, so change LEAD_FROM only after the new domain is verified there.
 */
const FROM = process.env.LEAD_FROM ?? "Michael Winter <contact@michaelwinterrealestate.com>";

/** Used until addresses are entered in Settings: the sites' own lead inbox. */
const DEFAULT_TO = process.env.LEAD_TO ?? "michael.winter@juliabfee.com";

export type LeadEmailMode = "every" | "away";

export const MAX_RECIPIENTS = 5;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function senderAddress(): string {
  return FROM;
}

/** Where lead emails go, as set in Settings. */
export async function leadRecipients(): Promise<string[]> {
  const list = await getSetting<string[] | null>("lead_emails", null);
  return Array.isArray(list) ? list.filter((e) => EMAIL.test(e)) : [DEFAULT_TO];
}

/** Every new lead, or only those that arrive while Michael is away. */
export async function leadEmailMode(): Promise<LeadEmailMode> {
  return (await getSetting<LeadEmailMode>("lead_email_mode", "every")) === "away" ? "away" : "every";
}

type Kind = "lead" | "test" | "rescue" | "reply";

type Sent = { ok: true } | { ok: false; error: string };

/** Every send is recorded for the developer page, sent or not. */
async function record(
  meta: { kind: Kind; conversationId?: string | null },
  to: string[],
  subject: string,
  result: Sent,
): Promise<Sent> {
  try {
    await db()`
      insert into email_log (kind, conversation_id, recipients, subject, ok, error)
      values (${meta.kind}, ${meta.conversationId ?? null}, ${to}, ${subject}, ${result.ok}, ${result.ok ? null : result.error})`;
  } catch {
    // The email's own result matters more than its log line.
  }
  return result;
}

/**
 * Resend reports failures in its result rather than by throwing, so the
 * result is always read; a lead email that silently fails is a lost lead.
 */
async function send(
  meta: { kind: Kind; conversationId?: string | null },
  message: { to: string[]; subject: string; text: string; html: string; replyTo?: string | null },
): Promise<Sent> {
  return record(meta, message.to, message.subject, await deliver(message));
}

async function deliver(message: { to: string[]; subject: string; text: string; html: string; replyTo?: string | null }): Promise<Sent> {
  if (!emailConfigured()) return { ok: false, error: "Email sending is not set up: RESEND_API_KEY is missing." };
  if (message.to.length === 0) return { ok: false, error: "No email address is set in Settings." };
  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    });
    if (error) {
      console.error(JSON.stringify({ mailError: error.name }));
      return { ok: false, error: error.message || error.name };
    }
    return { ok: true };
  } catch (err) {
    console.error(JSON.stringify({ mailError: (err as Error).name }));
    return { ok: false, error: "The email service could not be reached." };
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** A short label for questions whose full wording is long (the SMS consent). */
function shortLabel(a: Answer): string {
  if (a.key === "sms_consent") return "Text messages";
  return a.label.length > 48 ? `${a.label.slice(0, 46)}…` : a.label;
}

function layout(
  title: string,
  intro: string,
  body: string,
  button?: { href: string; label: string },
  frame: { label: string; footer: string } = {
    label: "MW Chat",
    footer: "Sent by MW Chat for westchesterguy.com and westchesterhorseproperties.com",
  },
): string {
  return `<!doctype html><html><body style="margin:0;background:#f3f2ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#17181a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f2ee;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#002349;padding:20px 24px;color:#ffffff">
<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.7">${esc(frame.label)}</div>
<div style="font-size:20px;font-weight:600;margin-top:4px">${title}</div>
<div style="font-size:14px;opacity:.8;margin-top:4px">${intro}</div>
</td></tr>
<tr><td style="padding:20px 24px">${body}
${button ? `<a href="${esc(button.href)}" style="display:inline-block;margin-top:20px;background:#002349;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:999px">${esc(button.label)}</a>` : ""}
</td></tr></table>
<div style="font-size:12px;color:#6b6a66;margin-top:14px;max-width:520px;line-height:1.5">${esc(frame.footer)}</div>
</td></tr></table></body></html>`;
}

function rows(items: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse">${items
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px 8px 0;color:#6b6a66;vertical-align:top;width:130px;border-bottom:1px solid #eeece6">${esc(k)}</td><td style="padding:8px 0;vertical-align:top;border-bottom:1px solid #eeece6">${esc(v)}</td></tr>`,
    )
    .join("")}</table>`;
}

function heading(text: string): string {
  return `<div style="font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#6b6a66;margin:20px 0 6px">${esc(text)}</div>`;
}

export interface Lead {
  to: string[];
  conversationId: string;
  domain: string;
  answers: Answer[];
  message: string;
  pageUrl: string | null;
  pageTitle: string | null;
  origin: Origin;
  adminUrl: string;
  replyTo: string | null;
  away: boolean;
}

/** One email per new lead: where the chat started, IP and location, the answers, the first message. */
export async function emailLead(lead: Lead): Promise<Sent> {
  const name = lead.answers.find((a) => a.key === "name")?.value ?? "A visitor";
  const where = [lead.origin.city, lead.origin.region, lead.origin.country].filter(Boolean).join(", ") || "Unknown";
  const page = lead.pageTitle && lead.pageUrl ? `${lead.pageTitle} (${lead.pageUrl})` : lead.pageUrl ?? "Unknown";
  const when = new Date().toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
  const started: [string, string][] = [
    ["Site", lead.domain],
    ["Page", page],
    ["When", `${when} ET`],
    ["IP address", lead.origin.ip ?? "Unknown"],
    ["Location", where],
  ];
  const answers: [string, string][] = lead.answers.map((a) => [shortLabel(a), a.value]);
  const intro = lead.away ? `${lead.domain} · you were away` : lead.domain;

  const text = `New chat lead on ${lead.domain}${lead.away ? " (you were away)" : ""}

CHAT STARTED ON
${started.map(([k, v]) => `${k}: ${v}`).join("\n")}

LEAD DETAILS
${answers.map(([k, v]) => `${k}: ${v}`).join("\n")}

FIRST MESSAGE
${lead.message}

Reply in MW Chat: ${lead.adminUrl}
`;

  const html = layout(
    `New lead: ${esc(name)}`,
    esc(intro),
    `${heading("First message")}<div style="font-size:15px;line-height:1.5;background:#f3f2ee;border-radius:12px;padding:12px 14px;white-space:pre-wrap">${esc(lead.message)}</div>
${heading("Lead details")}${rows(answers)}
${heading("Chat started on")}${rows(started)}`,
    { href: lead.adminUrl, label: "Reply in MW Chat" },
  );

  return send(
    { kind: "lead", conversationId: lead.conversationId },
    { to: lead.to, subject: `[Chat] New lead on ${lead.domain}: ${name}`, text, html, replyTo: lead.replyTo },
  );
}

/** From the Settings button, to prove the addresses and the sender work. */
export async function emailTest(to: string[]): Promise<Sent> {
  const text = "This is a test from MW Chat. New leads from your websites will arrive at this address.";
  return send({ kind: "test" }, {
    to,
    subject: "[Chat] Test email from MW Chat",
    text,
    html: layout("Test email", "Lead emails are working", `<p style="font-size:15px;line-height:1.5;margin:0">${esc(text)}</p>`),
  });
}

/** A visitor has waited the set time with no reply while Michael is online. */
export async function emailStillWaiting(p: {
  to: string[];
  conversationId: string;
  domain: string;
  name: string;
  minutes: number;
  lastMessage: string;
  adminUrl: string;
}): Promise<Sent> {
  const wait = `${p.minutes} ${p.minutes === 1 ? "minute" : "minutes"}`;
  const text = `${p.name} has waited ${wait} for a reply on ${p.domain}. They were told you have their message and will follow up.

LAST MESSAGE
${p.lastMessage}

Reply in MW Chat: ${p.adminUrl}
`;
  const html = layout(
    `${esc(p.name)} is waiting`,
    esc(`${p.domain} · no reply for ${wait}`),
    `<p style="font-size:15px;line-height:1.5;margin:0">They were told you have their message and will follow up.</p>
${heading("Last message")}<div style="font-size:15px;line-height:1.5;background:#f3f2ee;border-radius:12px;padding:12px 14px;white-space:pre-wrap">${esc(p.lastMessage)}</div>`,
    { href: p.adminUrl, label: "Reply in MW Chat" },
  );
  return send(
    { kind: "rescue", conversationId: p.conversationId },
    { to: p.to, subject: `[Chat] ${p.name} is still waiting on ${p.domain}`, text, html },
  );
}

/**
 * Michael's replies, sent to a visitor who left before they arrived. Their
 * email reply goes to Michael's inbox; the button reopens the chat on the
 * site (in the same browser).
 */
export async function emailVisitorReply(p: {
  to: string;
  conversationId: string;
  name: string | null;
  domain: string;
  messages: { body: string; file: { name: string; url: string; type: string } | null }[];
  continueUrl: string;
  replyTo: string | null;
}): Promise<Sent> {
  const first = p.name?.trim().split(/\s+/)[0];
  const hello = first ? `Hi ${first},` : "Hello,";
  const lines = p.messages.map((m) =>
    [m.body, m.file ? `${m.file.type === "application/pdf" ? "PDF" : "Photo"}: ${m.file.name} (${m.file.url})` : ""]
      .filter(Boolean)
      .join("\n"),
  );
  const text = `${hello}

Michael Winter replied to your chat on ${p.domain}:

${lines.join("\n\n")}

Continue the chat: ${p.continueUrl}
Or reply to this email.

You're receiving this because you started a chat on ${p.domain} and left your email address.
`;
  const bubbles = p.messages
    .map(
      (m) =>
        `<div style="font-size:15px;line-height:1.5;background:#f3f2ee;border-radius:12px;padding:12px 14px;margin-top:8px;white-space:pre-wrap">${esc(m.body)}${
          m.file
            ? `${m.body ? "<br>" : ""}<a href="${esc(m.file.url)}" style="color:#002349;font-weight:600">${m.file.type === "application/pdf" ? "PDF" : "Photo"}: ${esc(m.file.name)}</a>`
            : ""
        }</div>`,
    )
    .join("");
  const html = layout(
    "A reply from Michael Winter",
    esc(p.domain),
    `<p style="font-size:15px;line-height:1.5;margin:0">${esc(hello)}</p>
<p style="font-size:15px;line-height:1.5;margin:10px 0 0">Michael replied to your chat:</p>${bubbles}
<p style="font-size:14px;line-height:1.5;margin:16px 0 0;color:#6b6a66">Continue the chat on the site, or simply reply to this email.</p>`,
    { href: p.continueUrl, label: "Continue the chat" },
    {
      label: "Michael Winter",
      footer: `You're receiving this because you started a chat on ${p.domain} and left your email address.`,
    },
  );
  return send(
    { kind: "reply", conversationId: p.conversationId },
    { to: [p.to], subject: "Michael Winter replied to your message", text, html, replyTo: p.replyTo },
  );
}
