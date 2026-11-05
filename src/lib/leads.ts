import { db } from "./db";
import { townFromUrl } from "./greeting";
import { sites } from "./sites";

export interface LeadFilter {
  q: string | null;
  site: string | null;
  from: string | null; // YYYY-MM-DD, Eastern time
  to: string | null;
}

export interface LeadRow {
  id: string;
  created_at: string;
  site: string;
  status: "open" | "closed";
  start_url: string | null;
  start_title: string | null;
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  started_away: boolean;
  prechat: { key: string; label: string; value: string }[];
  visitor_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  messages: number;
  first_reply_at: string | null;
  town: string | null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function leadFilter(req: Request): LeadFilter {
  const p = new URL(req.url).searchParams;
  const q = p.get("q")?.trim().slice(0, 100) || null;
  const site = p.get("site");
  const from = p.get("from");
  const to = p.get("to");
  return {
    q,
    site: site && site in sites ? site : null,
    from: from && DAY.test(from) ? from : null,
    to: to && DAY.test(to) ? to : null,
  };
}

/** One row per chat, newest first, with the visitor's contact details and answers. */
export async function findLeads(f: LeadFilter, limit: number, offset: number) {
  const like = f.q ? `%${f.q.replace(/[\\%_]/g, "\\$&")}%` : null;
  const where = db()`
    where (${f.site}::text is null or c.site = ${f.site})
      and (${f.from}::date is null or c.created_at >= (${f.from}::date)::timestamp at time zone 'America/New_York')
      and (${f.to}::date is null or c.created_at < ((${f.to}::date + 1)::timestamp at time zone 'America/New_York'))
      and (${like}::text is null
        or v.name ilike ${like} or v.email ilike ${like} or v.phone ilike ${like}
        or c.start_title ilike ${like} or c.start_url ilike ${like} or c.city ilike ${like} or c.region ilike ${like})`;
  const [rows, [{ total }]] = await Promise.all([
    db()`
      select c.id, c.created_at, c.site, c.status, c.start_url, c.start_title, c.ip, c.city, c.region, c.country,
             c.started_away, c.prechat, v.id as visitor_id, v.name, v.email, v.phone,
             (select count(*)::int from messages m where m.conversation_id = c.id and m.sender <> 'system') as messages,
             (select min(m.created_at) from messages m where m.conversation_id = c.id and m.sender = 'agent') as first_reply_at
      from conversations c join visitors v on v.id = c.visitor_id
      ${where}
      order by c.created_at desc
      limit ${limit} offset ${offset}`,
    db()`select count(*)::int as total from conversations c join visitors v on v.id = c.visitor_id ${where}`,
  ]);
  return {
    total: total as number,
    leads: rows.map(
      (r): LeadRow => ({
        ...(r as unknown as LeadRow),
        town: townFromUrl(r.start_url as string | null),
        prechat: (r.prechat ?? []) as LeadRow["prechat"],
      }),
    ),
  };
}
