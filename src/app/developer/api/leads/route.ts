import { devGuard } from "@/lib/dev-auth";
import { findLeads, leadFilter } from "@/lib/leads";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await devGuard(req);
  if (denied) return denied;
  const page = Math.max(0, Math.floor(Number(new URL(req.url).searchParams.get("page")) || 0));
  const { total, leads } = await findLeads(leadFilter(req), 50, page * 50);
  return Response.json({ total, page, pageSize: 50, leads }, { headers: { "cache-control": "no-store" } });
}
