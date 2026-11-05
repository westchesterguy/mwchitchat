import { devGuard } from "@/lib/dev-auth";
import { findLeads, leadFilter } from "@/lib/leads";
import { sites, type SiteId } from "@/lib/sites";

export const dynamic = "force-dynamic";

/** A cell for a spreadsheet: quoted, and never read as a formula. */
function cell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

const eastern = (d: unknown) =>
  d ? new Date(d as string).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "short", timeStyle: "short" }) : "";

/** The leads matching the page's filters, as a CSV file for a CRM or spreadsheet. */
export async function GET(req: Request) {
  const denied = await devGuard(req);
  if (denied) return denied;
  const { leads } = await findLeads(leadFilter(req), 20_000, 0);
  const header = ["Date (ET)", "Name", "Email", "Phone", "Site", "Town", "Started on page", "Page address", "City", "State", "Country", "IP address", "Status", "Started while away", "Messages", "Answers"];
  const lines = leads.map((l) =>
    [
      eastern(l.created_at),
      l.name,
      l.email,
      l.phone,
      sites[l.site as SiteId]?.domain ?? l.site,
      l.town,
      l.start_title,
      l.start_url,
      l.city,
      l.region,
      l.country,
      l.ip,
      l.status,
      l.started_away ? "Yes" : "No",
      l.messages,
      l.prechat.filter((a) => !["name", "email", "phone"].includes(a.key)).map((a) => `${a.label}: ${a.value}`).join("; "),
    ]
      .map(cell)
      .join(","),
  );
  const day = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + [header.map(cell).join(","), ...lines].join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="mw-chat-leads-${day}.csv"`,
      "cache-control": "no-store",
    },
  });
}
