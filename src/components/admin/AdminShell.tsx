"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Mark } from "../Mark";
import { adminApi } from "./util";

/** Header for every signed-in screen: brand, online switch, navigation. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/admin" }).catch(() => {});
    }
    adminApi<{ online: boolean }>("/api/admin/settings").then(({ ok, data }) => ok && setOnline(data.online));
  }, []);

  const toggle = async () => {
    if (online === null) return;
    const { ok, data } = await adminApi<{ online: boolean }>("/api/admin/settings", "PUT", { online: !online });
    if (ok) setOnline(data.online);
  };

  const tab = (href: string, label: string) => {
    const active = href === "/admin" ? path === "/admin" || path.startsWith("/admin/c/") : path.startsWith(href);
    return (
      <Link
        href={href}
        className={`px-1 py-3 text-[13px] ${active ? "border-b-2 border-white text-white" : "text-white/65 hover:text-white"}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="on-navy sticky top-0 z-10 bg-navy text-white pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 pt-3">
          <Mark className="w-6" />
          <span className="font-display text-[18px]">MW Chat</span>
          <button
            type="button"
            onClick={toggle}
            disabled={online === null}
            aria-pressed={online ?? undefined}
            className="ml-auto flex items-center gap-2 rounded-full border border-white/30 px-3 py-1.5 text-[12px]"
          >
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${online ? "bg-[#4cc28a]" : "bg-white/40"}`}
            />
            {online === null ? "…" : online ? "Online" : "Away"}
          </button>
        </div>
        <nav className="flex gap-5 px-4">
          {tab("/admin", "Chats")}
          {tab("/admin/settings", "Settings")}
        </nav>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
