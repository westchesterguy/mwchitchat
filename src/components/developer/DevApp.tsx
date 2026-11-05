"use client";

import { useState } from "react";
import { Mark } from "../Mark";
import { ExternalIcon, LogoutIcon } from "../ui/icons";
import { Activity } from "./Activity";
import { ChatSettingsPanel } from "./ChatSettingsPanel";
import { DataTools } from "./DataTools";
import { Health } from "./Health";
import { Leads } from "./Leads";

export type Tab = "leads" | "activity" | "health" | "settings" | "data";

const TABS: { id: Tab; label: string }[] = [
  { id: "leads", label: "Leads" },
  { id: "activity", label: "Activity" },
  { id: "health", label: "Health" },
  { id: "settings", label: "Chat settings" },
  { id: "data", label: "Data" },
];

/**
 * The developer page: leads, activity, health, the chat's behaviour and
 * data tools, for a web browser. Kept apart from the chat app at /chatapp.
 */
export function DevApp({ initialTab }: { initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);

  const choose = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url);
  };

  const signOut = async () => {
    await fetch("/developer/api/logout", { method: "POST" }).catch(() => null);
    window.location.reload();
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="on-navy bg-chrome text-white">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 sm:px-6">
          <Mark className="w-7" />
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="font-display text-[20px] leading-none">MW Chat</span>
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]">
              Developer
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <a
              href="/chatapp"
              target="_blank"
              rel="noopener"
              className="press hidden items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium text-white/85 hover:bg-white/10 sm:inline-flex"
            >
              Chat app <ExternalIcon className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={signOut}
              className="press inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium text-white/85 hover:bg-white/10"
            >
              <LogoutIcon className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <nav className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div role="tablist" className="scroll-thin mx-auto flex max-w-[1240px] gap-1 overflow-x-auto px-3 sm:px-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => choose(t.id)}
              className={`relative shrink-0 px-3 py-3.5 text-[14px] font-medium transition-colors ${
                tab === t.id ? "text-accent" : "text-muted hover:text-ink"
              }`}
            >
              {t.label}
              {tab === t.id && <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-accent" />}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-[1240px] px-4 pb-24 pt-5 sm:px-6 sm:pt-6">
        {tab === "leads" && <Leads />}
        {tab === "activity" && <Activity />}
        {tab === "health" && <Health />}
        {tab === "settings" && <ChatSettingsPanel />}
        {tab === "data" && <DataTools />}
      </main>
    </div>
  );
}
