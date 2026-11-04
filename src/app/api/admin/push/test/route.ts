import { adminGuard } from "@/lib/admin-auth";
import { notifyAgent } from "@/lib/push";

export async function POST(req: Request) {
  const denied = await adminGuard(req);
  if (denied) return denied;
  await notifyAgent({
    title: "Test notification",
    body: "Notifications are working on this device.",
    url: "/admin",
    tag: "test",
  });
  return Response.json({ ok: true });
}
