import { headers } from "next/headers";
import { Settings } from "@/components/admin/Settings";

export default async function SettingsPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const appUrl = (process.env.APP_URL ?? `${proto}://${host}`).replace(/\/$/, "");
  return <Settings appUrl={appUrl} />;
}
