"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Mark } from "../Mark";
import { SettingsIcon } from "../ui/icons";
import { Inbox } from "./Inbox";
import { applyTheme, getTheme } from "./prefs";
import { unlockAudio } from "./tones";
import { adminApi } from "./util";

interface Presence {
  online: boolean | null;
  setOnline: (next: boolean) => Promise<void>;
}

const PresenceContext = createContext<Presence>({ online: null, setOnline: async () => {} });

/** Online/away, shared by the list header and Settings. */
export const usePresence = () => useContext(PresenceContext);

/**
 * The app frame. On a phone the chat list is its own screen and a chat opens
 * full-screen over it; from a laptop width up the list stays on the left and
 * the chat or settings fill the rest, like a desktop messaging app.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const onList = path === "/admin";
  const activeId = path.startsWith("/admin/c/") ? path.split("/")[3] ?? null : null;
  const [online, setOnlineState] = useState<boolean | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/admin" }).catch(() => {});
    }
    adminApi<{ online: boolean }>("/api/admin/settings").then(({ ok, data }) => ok && setOnlineState(data.online));
  }, []);

  // Sounds need a first tap; Automatic theme follows the device as it changes.
  useEffect(() => {
    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => getTheme() === "system" && applyTheme();
    scheme.addEventListener("change", follow);
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      scheme.removeEventListener("change", follow);
    };
  }, []);

  const setOnline = useCallback(async (next: boolean) => {
    setOnlineState(next);
    const { ok, data } = await adminApi<{ online: boolean }>("/api/admin/settings", "PUT", { online: next });
    setOnlineState(ok ? data.online : !next);
  }, []);

  return (
    <PresenceContext.Provider value={{ online, setOnline }}>
      <div className="flex h-dvh overflow-hidden bg-paper">
        <aside
          className={`${onList ? "flex" : "hidden"} w-full min-w-0 flex-col bg-surface lg:flex lg:w-[380px] lg:shrink-0 lg:border-r lg:border-line`}
        >
          <header className="on-navy bg-chrome px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
            <div className="flex h-11 items-center gap-3">
              <Mark className="w-6" />
              <h1 className="text-[21px] font-semibold tracking-[-0.01em]">Chats</h1>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => online !== null && setOnline(!online)}
                  disabled={online === null}
                  aria-pressed={online ?? undefined}
                  className="press flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-medium hover:bg-white/15"
                >
                  <span
                    aria-hidden
                    className={`h-2 w-2 rounded-full transition-colors ${online ? "bg-live" : "bg-white/40"}`}
                  />
                  {online === null ? "…" : online ? "Online" : "Away"}
                </button>
                <Link
                  href="/admin/settings"
                  aria-label="Settings"
                  className={`press rounded-full p-2 hover:bg-white/10 ${path === "/admin/settings" ? "bg-white/15" : ""}`}
                >
                  <SettingsIcon className="h-[22px] w-[22px]" />
                </Link>
              </div>
            </div>
          </header>
          <Inbox activeId={activeId} />
        </aside>
        <main className={`${onList ? "hidden lg:flex" : "flex"} min-w-0 flex-1 flex-col`}>{children}</main>
      </div>
    </PresenceContext.Provider>
  );
}
