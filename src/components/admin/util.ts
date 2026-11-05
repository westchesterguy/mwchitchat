"use client";

import { sites, type SiteId } from "@/lib/sites";

/** Admin API call. A signed-out response sends the app back to the login. */
export async function adminApi<T = Record<string, unknown>>(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (res.status === 401) {
    window.location.href = "/chatapp/login";
  }
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

/** Runs `fn` now and then every `ms` while the app is on screen. */
export function poll(fn: () => Promise<void>, ms: number): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const run = async () => {
    if (document.visibilityState === "visible") {
      try {
        await fn();
      } catch {}
    }
    if (!stopped) timer = setTimeout(run, ms);
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") {
      clearTimeout(timer);
      run();
    }
  };
  document.addEventListener("visibilitychange", onVisible);
  run();
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

export function siteName(id: string | null | undefined): string {
  return (id && sites[id as SiteId]?.domain) || id || "Unknown site";
}

export function siteShort(id: string | null | undefined): string {
  return id === "horse" ? "Horse Properties" : id === "westchesterguy" ? "Westchester Guy" : id ?? "";
}

const regions = typeof Intl !== "undefined" && "DisplayNames" in Intl
  ? new Intl.DisplayNames(["en"], { type: "region" })
  : null;

export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  try {
    return regions?.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function place(v: { city?: string | null; region?: string | null; country?: string | null }): string {
  return [v.city, v.region, countryName(v.country)].filter(Boolean).join(", ");
}

/** Browser and system from a user-agent string, roughly. */
export function device(ua: string | null | undefined): string {
  if (!ua) return "Unknown";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const system = /iPhone|iPad|iPod/.test(ua)
    ? "iPhone/iPad"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "Mac"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return system ? `${browser} on ${system}` : browser;
}

export function pagePath(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return url;
  }
}
