"use client";

import { useEffect, useState } from "react";

/**
 * The developer page is for a web browser. Opened inside the installed MW
 * Chat app (the Android app or a home-screen install), it says so instead.
 */
export function WebOnly({ children }: { children: React.ReactNode }) {
  const [inApp, setInApp] = useState(false);
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      document.referrer.startsWith("android-app://") ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInApp(standalone);
  }, []);
  if (!inApp) return <>{children}</>;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-8 text-center">
      <p className="text-[17px] font-semibold text-ink">Open this in a web browser</p>
      <p className="mt-2 max-w-sm text-[14px] text-muted">
        The developer page isn&rsquo;t part of the MW Chat app. Go to chat.westchesterguy.com/developer in Chrome or Safari,
        ideally on a computer.
      </p>
    </div>
  );
}
