import { createHash } from "node:crypto";
import { db } from "./db";
import type { Origin } from "./request";

/**
 * A visitor is identified by a random token the widget creates and keeps in
 * the visitor's browser (on the site they are browsing). Only its hash is
 * stored, so the database alone cannot be used to impersonate anyone.
 */
const TOKEN = /^[A-Za-z0-9_-]{32,128}$/;

export function visitorToken(req: Request): string | null {
  const token = req.headers.get("x-mwchat-token");
  return token && TOKEN.test(token) ? token : null;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface PageInfo {
  site: string;
  url: string | null;
  title: string | null;
  referrer?: string | null;
}

/** Creates the visitor on first contact, otherwise records where they are now. */
export async function upsertVisitor(
  token: string,
  page: PageInfo,
  origin: Origin,
): Promise<string> {
  const [row] = await db()`
    insert into visitors (
      token_hash, first_site, current_site, current_url, current_title, referrer,
      ip, country, region, city, user_agent
    ) values (
      ${hashToken(token)}, ${page.site}, ${page.site}, ${page.url}, ${page.title},
      ${page.referrer ?? null}, ${origin.ip}, ${origin.country}, ${origin.region},
      ${origin.city}, ${origin.userAgent}
    )
    on conflict (token_hash) do update set
      last_seen_at  = now(),
      current_site  = excluded.current_site,
      current_url   = coalesce(excluded.current_url, visitors.current_url),
      current_title = coalesce(excluded.current_title, visitors.current_title),
      referrer      = coalesce(visitors.referrer, excluded.referrer),
      ip            = coalesce(excluded.ip, visitors.ip),
      country       = coalesce(excluded.country, visitors.country),
      region        = coalesce(excluded.region, visitors.region),
      city          = coalesce(excluded.city, visitors.city),
      user_agent    = coalesce(excluded.user_agent, visitors.user_agent)
    returning id`;
  return row.id as string;
}

export interface VisitorConversation {
  visitorId: string;
  conversationId: string | null;
  status: "open" | "closed" | null;
  site: string | null;
}

/** The visitor behind a token and their latest conversation, if any. */
export async function findVisitor(token: string): Promise<VisitorConversation | null> {
  const [row] = await db()`
    select v.id as visitor_id, c.id as conversation_id, c.status, c.site
    from visitors v
    left join lateral (
      select id, status, site from conversations
      where visitor_id = v.id order by created_at desc limit 1
    ) c on true
    where v.token_hash = ${hashToken(token)}`;
  if (!row) return null;
  return {
    visitorId: row.visitor_id,
    conversationId: row.conversation_id ?? null,
    status: row.status ?? null,
    site: row.site ?? null,
  };
}

/** Marks the visitor as present, at most every 15 seconds. */
export async function touchVisitor(visitorId: string): Promise<void> {
  await db()`
    update visitors set last_seen_at = now()
    where id = ${visitorId} and last_seen_at < now() - interval '15 seconds'`;
}
