"use client";

import { ANDROID_APP } from "@/lib/android-app";

/**
 * Whether the chat app is open inside the Android app, and which version.
 * The app opens /chatapp?app=android&v=2 (version 1.1 and later); version
 * 1.0 opened /admin, so it is known only by Android's referrer. Remembered on
 * this device, and counted only while running full-screen as an app.
 */
const KEY = "mwchat:android";

export function noteAndroidApp() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("app") === "android") {
      localStorage.setItem(KEY, String(Number(params.get("v")) || 1));
      params.delete("app");
      params.delete("v");
      const rest = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash);
    } else if (document.referrer.startsWith(`android-app://${ANDROID_APP.packageName}`) && !localStorage.getItem(KEY)) {
      localStorage.setItem(KEY, "1");
    }
  } catch {}
}

/** The Android app's version code if this page is running inside it, else null. */
export function androidAppCode(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY));
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    return v && standalone ? v : null;
  } catch {
    return null;
  }
}

/** Opens the Android app's alert-sound setting for a tone (version 1.1 and later). */
export function setPhoneTone(id: string) {
  window.location.href = `intent://tone?id=${encodeURIComponent(id)}#Intent;scheme=mwchat;package=${ANDROID_APP.packageName};end`;
}
