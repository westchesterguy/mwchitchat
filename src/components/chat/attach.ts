"use client";

/**
 * Getting a photo or PDF ready to send. Photos from a phone camera are
 * several MB; they are redrawn at most 1600 px on the long side as JPEG,
 * which keeps them sharp on any screen at a few hundred KB.
 */

export const FILE_MAX = 4 * 1024 * 1024;
export const ACCEPT = "image/*,application/pdf";
const LONG_SIDE = 1600;
const KEEP_AS_IS = 1.2 * 1024 * 1024;
const SENDABLE = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];

export interface Outgoing {
  blob: Blob;
  name: string;
  type: string;
  width: number | null;
  height: number | null;
  /** A local address for showing it before the upload finishes. */
  preview: string;
}

export type Prepared = { ok: true; file: Outgoing } | { ok: false; error: string };

function outgoing(blob: Blob, name: string, width: number | null, height: number | null): Outgoing {
  return { blob, name, type: blob.type, width, height, preview: URL.createObjectURL(blob) };
}

function jpegName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "") || "photo";
  return `${base}.jpg`;
}

export async function prepareFile(file: File): Promise<Prepared> {
  if (file.type === "application/pdf") {
    if (file.size > FILE_MAX) return { ok: false, error: "PDFs can be up to 4 MB." };
    return { ok: true, file: outgoing(file, file.name || "document.pdf", null, null) };
  }
  if (!file.type.startsWith("image/")) return { ok: false, error: "You can send photos and PDFs." };

  // Animated GIFs would lose their motion if redrawn.
  if (file.type === "image/gif") {
    if (file.size > FILE_MAX) return { ok: false, error: "GIFs can be up to 4 MB." };
    const dims = await measure(file);
    return { ok: true, file: outgoing(file, file.name || "image.gif", dims?.width ?? null, dims?.height ?? null) };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false, error: "This photo's format can't be opened here. Try a JPEG or a screenshot." };
  }
  const { width, height } = bitmap;
  const small = Math.max(width, height) <= LONG_SIDE && file.size <= KEEP_AS_IS && SENDABLE.includes(file.type);
  if (small) {
    bitmap.close();
    return { ok: true, file: outgoing(file, file.name || "photo", width, height) };
  }

  const scale = Math.min(1, LONG_SIDE / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, error: "This photo could not be prepared." };
  // A white ground so transparent PNGs don't turn black as JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) return { ok: false, error: "This photo could not be prepared." };
  if (blob.size > FILE_MAX) return { ok: false, error: "This photo is too large to send." };
  return { ok: true, file: outgoing(blob, jpegName(file.name || "photo"), w, h) };
}

async function measure(file: Blob): Promise<{ width: number; height: number } | null> {
  try {
    const b = await createImageBitmap(file);
    const dims = { width: b.width, height: b.height };
    b.close();
    return dims;
  } catch {
    return null;
  }
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Sends a message: JSON for text alone, a form when a file goes with it.
 * Never throws; a network failure comes back as status 0.
 */
export async function postMessage<T = Record<string, unknown>>(
  path: string,
  text: string,
  file: Outgoing | null,
  headers: Record<string, string> = {},
): Promise<{ ok: boolean; status: number; data: T }> {
  try {
    let init: RequestInit;
    if (file) {
      const form = new FormData();
      form.set("body", text);
      form.set("file", file.blob, file.name);
      if (file.width) form.set("width", String(file.width));
      if (file.height) form.set("height", String(file.height));
      init = { method: "POST", headers, body: form };
    } else {
      init = { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ body: text }) };
    }
    const res = await fetch(path, { ...init, cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as T;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: {} as T };
  }
}
