import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { ThemeScript } from "@/components/admin/ThemeScript";
import { isAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "MW Chat",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "MW Chat", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/admin/login");
  return (
    <>
      <ThemeScript />
      <AdminShell>{children}</AdminShell>
    </>
  );
}
