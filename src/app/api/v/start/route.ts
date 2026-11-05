import { after } from "next/server";
import { addMessage, adminLink, MESSAGE_MAX, messagesAfter } from "@/lib/chat";
import { getChatSettings } from "@/lib/chat-settings";
import { db, getSetting } from "@/lib/db";
import { answerOf, fieldsForSite, validateAnswers } from "@/lib/fields";
import { isSameOrigin, jsonError, overLimit } from "@/lib/guard";
import { emailLead, leadEmailMode, leadRecipients } from "@/lib/mail";
import { notifyAgent } from "@/lib/push";
import { pageUrl, readJson, requestOrigin, str } from "@/lib/request";
import { getSite } from "@/lib/sites";
import { findVisitor, upsertVisitor, visitorToken } from "@/lib/visitor";

/**
 * The visitor submits the pre-chat questions and their first message.
 * Creates the visitor and the conversation, and tells Michael.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return jsonError(403, "forbidden");
  if (overLimit(req, "start", 6, 60 * 60_000)) return jsonError(429, "rate_limited");

  const token = visitorToken(req);
  const body = await readJson(req);
  const site = getSite(body?.site);
  if (!token || !body || !site) return jsonError(400, "bad_request");

  const message = str(body.message, MESSAGE_MAX);
  if (!message) return Response.json({ error: "invalid", field: "message" }, { status: 400 });

  const fields = await fieldsForSite(site.id);
  const check = validateAnswers(fields, body.answers);
  if (!check.ok) {
    return Response.json({ error: "invalid", field: check.field, message: check.error }, { status: 400 });
  }
  const { answers } = check;

  const page = (body.page ?? {}) as Record<string, unknown>;
  const url = pageUrl(page.url);
  const title = str(page.title, 300) || null;
  const origin = requestOrigin(req);

  const visitorId = await upsertVisitor(
    token,
    { site: site.id, url, title, referrer: pageUrl(page.referrer) },
    origin,
  );
  await db()`
    update visitors set
      name  = coalesce(${answerOf(answers, "name")}, name),
      email = coalesce(${answerOf(answers, "email")}, email),
      phone = coalesce(${answerOf(answers, "phone")}, phone)
    where id = ${visitorId}`;

  // A visitor with a chat still open carries on in it rather than starting
  // a second one.
  const existing = await findVisitor(token);
  let conversationId =
    existing?.status === "open" ? existing.conversationId : null;
  const isNew = !conversationId;

  if (!conversationId) {
    const [row] = await db()`
      insert into conversations (
        visitor_id, site, start_url, start_title, prechat, ip, country, region, city
      ) values (
        ${visitorId}, ${site.id}, ${url}, ${title}, ${db().json(answers as never)},
        ${origin.ip}, ${origin.country}, ${origin.region}, ${origin.city}
      ) returning id`;
    conversationId = row.id as string;
  }

  await addMessage(conversationId, "visitor", message);

  const online = await getSetting<boolean>("agent_online", true);
  const name = answerOf(answers, "name") ?? "A visitor";
  const link = adminLink(req, `/admin/c/${conversationId}`);

  if (isNew && !online) {
    await addMessage(conversationId, "system", (await getChatSettings()).awayMessage);
    await db()`update conversations set started_away = true where id = ${conversationId}`;
  }

  // Every new lead is emailed to the addresses in Settings, or only those
  // that arrive while Michael is away, as he chooses there.
  if (isNew && ((await leadEmailMode()) === "every" || !online)) {
    const to = await leadRecipients();
    if (to.length) {
      after(() =>
        emailLead({
          to,
          conversationId: conversationId!,
          domain: site.domain,
          answers,
          message,
          pageUrl: url,
          pageTitle: title,
          origin,
          adminUrl: link,
          replyTo: answerOf(answers, "email"),
          away: !online,
        }),
      );
    }
  }

  after(() =>
    notifyAgent({
      title: isNew ? `New chat: ${name}` : `${name} (${site.domain})`,
      body: isNew ? `${site.domain}: ${message}` : message,
      url: `/admin/c/${conversationId}`,
      tag: conversationId!,
    }),
  );

  return Response.json({
    conversation: { id: conversationId, status: "open" },
    messages: await messagesAfter(conversationId, 0),
    online,
  });
}
