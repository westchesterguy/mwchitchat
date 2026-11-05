import { db } from "@/lib/db";
import { devGuard } from "@/lib/dev-auth";
import { townFromUrl } from "@/lib/greeting";

export const dynamic = "force-dynamic";

/** Chats over the last 30, 90 or 365 days: per day, where, when, and how fast Michael answered. */
export async function GET(req: Request) {
  const denied = await devGuard(req);
  if (denied) return denied;
  const asked = Number(new URL(req.url).searchParams.get("days"));
  const days = [30, 90, 365].includes(asked) ? asked : 30;
  const since = db()`c.created_at >= now() - make_interval(days => ${days})`;

  const [perDay, pages, hours, places, [totals], [reply]] = await Promise.all([
    db()`
      select to_char((c.created_at at time zone 'America/New_York')::date, 'YYYY-MM-DD') as day, c.site, count(*)::int as n
      from conversations c where ${since}
      group by 1, 2 order by 1`,
    db()`
      select c.start_url as url, max(c.start_title) as title, count(*)::int as n
      from conversations c where ${since} and c.start_url is not null
      group by c.start_url order by n desc limit 10`,
    db()`
      select extract(hour from c.created_at at time zone 'America/New_York')::int as hour, count(*)::int as n
      from conversations c where ${since}
      group by 1 order by 1`,
    db()`
      select coalesce(nullif(concat_ws(', ', c.city, c.region), ''), c.country, 'Unknown') as place, count(*)::int as n
      from conversations c where ${since}
      group by 1 order by n desc limit 8`,
    db()`
      select count(*)::int as chats,
             count(distinct c.visitor_id)::int as people,
             count(*) filter (where v.email is not null)::int as with_email,
             count(*) filter (where v.phone is not null)::int as with_phone,
             count(*) filter (where c.started_away)::int as while_away
      from conversations c join visitors v on v.id = c.visitor_id where ${since}`,
    db()`
      with firsts as (
        select (select min(m.created_at) from messages m where m.conversation_id = c.id and m.sender = 'visitor') as asked,
               (select min(m.created_at) from messages m where m.conversation_id = c.id and m.sender = 'agent') as answered
        from conversations c where ${since}
      )
      select count(*)::int as chats,
             count(answered)::int as answered,
             percentile_cont(0.5) within group (order by extract(epoch from answered - asked))
               filter (where answered > asked) as median_seconds,
             count(*) filter (where answered - asked <= interval '5 minutes')::int as within_five
      from firsts`,
  ]);

  return Response.json(
    {
      days,
      perDay,
      pages: pages.map((p) => ({ ...p, town: townFromUrl(p.url as string) })),
      hours,
      places,
      totals,
      reply: { ...reply, median_seconds: reply.median_seconds === null ? null : Number(reply.median_seconds) },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
