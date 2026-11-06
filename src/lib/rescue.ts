import { after } from "next/server";
import { replyInChat } from "./ai/assistant";
import { getAiSettings } from "./ai/settings";
import { addMessage } from "./chat";
import { EMAIL_NOTE, getChatSettings } from "./chat-settings";
import { db, getSetting } from "./db";
import { emailConfigured, emailStillWaiting, emailVisitorReply, leadRecipients } from "./mail";
import { notifyAgent } from "./push";
import { sites, type SiteId } from "./sites";

/**
 * The rescue, for chats Michael can't answer in time.
 *
 * While he is online, a visitor who has waited the set number of minutes
 * after their last message gets a message saying he has their details and
 * will follow up, and Michael is notified and emailed again. It happens
 * once, until he replies; a chat that started while he was away has had
 * its away message and is not rescued again until then.
 *
 * Serverless functions can't keep a timer, so the check runs when the
 * visitor's own browser checks in: the chat window's polling and the
 * widget's page reports. That is when a rescue matters: they are there.
 */

const checked = new Map<string, number>();

/** The away or rescue message, with a note about email when it will reach them that way. */
export async function withEmailNote(message: string, visitorEmail: string | null): Promise<string> {
  const { emailReplies } = await getChatSettings();
  return emailReplies && visitorEmail && emailConfigured() ? `${message} ${EMAIL_NOTE}` : message;
}

export async function rescueIfWaiting(conversationId: string, appBase: string): Promise<boolean> {
  // At most every 15 seconds per chat on each server.
  const now = Date.now();
  if (now - (checked.get(conversationId) ?? 0) < 15_000) return false;
  checked.set(conversationId, now);
  if (checked.size > 5000) checked.clear();

  const settings = await getChatSettings();
  if (!settings.rescue.enabled) return false;
  if (!(await getSetting<boolean>("agent_online", true))) return false;

  // Claimed in one statement, so two checks at once can't both post it.
  const [c] = await db()`
    with last_agent as (
      select coalesce(max(created_at), '-infinity'::timestamptz) as at
      from messages where conversation_id = ${conversationId} and sender = 'agent'
    )
    update conversations c set rescued_at = now()
    from last_agent la
    where c.id = ${conversationId} and c.status = 'open'
      and (c.rescued_at is null or c.rescued_at < la.at)
      and exists (
        select 1 from messages m
        where m.conversation_id = c.id and m.sender = 'visitor'
          and m.created_at > la.at
          and m.created_at <= now() - make_interval(mins => ${settings.rescue.minutes})
      )
    returning c.id, c.site,
      (select v.name from visitors v where v.id = c.visitor_id) as name,
      (select v.email from visitors v where v.id = c.visitor_id) as email,
      (select m.body from messages m where m.conversation_id = c.id and m.sender = 'visitor' order by m.id desc limit 1) as last`;
  if (!c) return false;

  // With the assistant covering for Michael, it answers instead; the set
  // message is the fallback if it can't.
  const ai = await getAiSettings();
  const answered = ai.enabled && ai.mode === "cover" && (await replyInChat(conversationId));
  if (!answered) {
    await addMessage(conversationId, "system", await withEmailNote(settings.rescue.message, c.email as string | null));
  }

  if (settings.rescue.alert) {
    const name = (c.name as string | null) ?? "A visitor";
    const domain = sites[c.site as SiteId]?.domain ?? (c.site as string);
    const path = `/chatapp/c/${conversationId}`;
    after(async () => {
      await notifyAgent({
        title: `Still waiting: ${name}`,
        body: `No reply for ${settings.rescue.minutes} min on ${domain}. They were told you'll follow up.`,
        url: path,
        tag: conversationId,
      });
      const to = await leadRecipients();
      if (to.length && emailConfigured()) {
        await emailStillWaiting({
          to,
          conversationId,
          domain,
          name,
          minutes: settings.rescue.minutes,
          lastMessage: (c.last as string | null) || "(a photo or PDF)",
          adminUrl: `${appBase}${path}`,
        });
      }
    });
  }
  return true;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * After Michael replies: if the visitor has left the site and gave an
 * email, send them what he wrote since they were last there. Waits half a
 * minute first so a few quick messages go out as one email; a newer reply
 * takes over the wait.
 */
export async function emailRepliesIfGone(conversationId: string, messageId: number, appBase: string): Promise<void> {
  await wait(30_000);
  const settings = await getChatSettings();
  if (!settings.emailReplies || !emailConfigured()) return;

  const [c] = await db()`
    select c.site, c.start_url, c.visitor_emailed_upto, v.name, v.email, v.last_seen_at,
           v.last_seen_at > now() - interval '75 seconds' as here,
           (select max(id) from messages m where m.conversation_id = c.id and m.sender = 'agent') as last_agent
    from conversations c join visitors v on v.id = c.visitor_id
    where c.id = ${conversationId}`;
  if (!c?.email || c.here || Number(c.last_agent) !== messageId) return;

  const rows = await db()`
    select m.id, m.body, a.id as file_id, a.name as file_name, a.type as file_type
    from messages m left join attachments a on a.id = m.attachment_id
    where m.conversation_id = ${conversationId} and m.sender = 'agent'
      and m.id > ${c.visitor_emailed_upto} and m.id <= ${messageId}
      and m.created_at > ${c.last_seen_at}
    order by m.id`;
  if (!rows.length) return;

  const [claimed] = await db()`
    update conversations set visitor_emailed_upto = ${messageId}
    where id = ${conversationId} and visitor_emailed_upto < ${messageId}
    returning id`;
  if (!claimed) return;

  const site = sites[c.site as SiteId];
  const start = (c.start_url as string | null) ?? site?.origin ?? appBase;
  const [inbox] = await leadRecipients();
  await emailVisitorReply({
    to: c.email as string,
    conversationId,
    name: c.name as string | null,
    domain: site?.domain ?? (c.site as string),
    messages: rows.map((r) => ({
      body: r.body as string,
      file: r.file_id ? { name: r.file_name as string, type: r.file_type as string, url: `${appBase}/api/files/${r.file_id}` } : null,
    })),
    // widget.js opens the chat when the page address ends in #mwchat.
    continueUrl: `${start.split("#")[0]}#mwchat`,
    replyTo: inbox ?? null,
  });
}
