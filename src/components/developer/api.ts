"use client";

/** Calls the developer API; a lapsed sign-in reloads the page to the sign-in form. */
export async function devApi<T = Record<string, unknown>>(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: T }> {
  try {
    const res = await fetch(`/developer/api/${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    if (res.status === 401) window.location.reload();
    const data = (await res.json().catch(() => ({}))) as T;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: {} as T };
  }
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function when(iso: string | null | undefined, withTime = true): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  });
}

export function duration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "None yet";
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} hr`;
  return `${(seconds / 86400).toFixed(1)} days`;
}

/** "1 file", "3 files". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

export function pct(part: number, whole: number): string {
  return whole ? `${Math.round((part / whole) * 100)}%` : "0%";
}

export const card = "rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5";
export const h2 = "text-[16px] font-semibold text-ink";
export const sub = "mt-0.5 text-[13px] text-muted";
export const input =
  "h-10 rounded-xl border border-line bg-surface px-3 text-[14px] text-ink outline-none transition-[border-color,box-shadow] focus:border-navy/50 focus:shadow-[0_0_0_3px_rgba(0,35,73,0.08)]";
export const secondary =
  "press inline-flex h-10 items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 text-[14px] font-medium text-ink-soft hover:border-ink-soft/40 disabled:opacity-50";
export const primary =
  "press inline-flex h-10 items-center justify-center gap-2 rounded-full bg-navy px-5 text-[14px] font-medium text-white shadow-[0_2px_8px_rgba(0,35,73,0.25)] hover:bg-navy-light disabled:opacity-50 disabled:shadow-none";
export const danger =
  "press inline-flex h-10 items-center justify-center gap-2 rounded-full bg-danger px-5 text-[14px] font-medium text-white disabled:opacity-50";
