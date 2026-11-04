"use client";

/**
 * Per-device preferences for the admin app: theme, notification tone and
 * its volume. Kept in this device's storage, so a phone and a laptop can
 * differ, as they do in other messaging apps.
 */

export type Theme = "light" | "dark" | "system";

const KEYS = { theme: "mwchat:theme", tone: "mwchat:tone", volume: "mwchat:volume" } as const;
const CHANGED = "mwchat:prefs";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
  window.dispatchEvent(new Event(CHANGED));
}

export function getTheme(): Theme {
  const t = read(KEYS.theme);
  return t === "dark" || t === "system" ? t : "light";
}

export function setTheme(theme: Theme) {
  write(KEYS.theme, theme);
  applyTheme();
}

/** Puts the chosen theme on the page and matches the phone's status bar. */
export function applyTheme() {
  const t = getTheme();
  const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0d0f11" : "#002349");
}

export function getTone(): string {
  return read(KEYS.tone) ?? "bell";
}

export function setTone(id: string) {
  write(KEYS.tone, id);
}

export function getVolume(): number {
  const v = Number(read(KEYS.volume));
  return Number.isFinite(v) && read(KEYS.volume) !== null ? Math.min(1, Math.max(0, v)) : 0.7;
}

export function setVolume(v: number) {
  write(KEYS.volume, String(v));
}

export function onPrefsChange(fn: () => void): () => void {
  window.addEventListener(CHANGED, fn);
  return () => window.removeEventListener(CHANGED, fn);
}

/**
 * The same theme logic as applyTheme, inlined into the page so it runs
 * before anything is drawn and the app never flashes the wrong theme.
 */
export const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem("${KEYS.theme}");var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?"#0d0f11":"#002349")}catch(e){}})();`;
