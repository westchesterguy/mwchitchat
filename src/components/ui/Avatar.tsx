"use client";

import { useState } from "react";

/** Muted, brand-adjacent tones, picked per person so the list scans. */
const TONES = ["#002349", "#2c4a6e", "#4a6b8a", "#5b4e44", "#3d5d58", "#55496a", "#6a4f3c"];

function tone(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TONES[Math.abs(h) % TONES.length];
}

export function initials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-11 w-11 text-[14px]",
  lg: "h-14 w-14 text-[17px]",
} as const;

/**
 * A round avatar: a photo when given one, otherwise initials on a tone
 * chosen from the name. `online` adds the green presence dot.
 */
export function Avatar({
  name,
  src,
  size = "md",
  online,
  ring,
}: {
  name: string | null | undefined;
  src?: string;
  size?: keyof typeof SIZES;
  online?: boolean;
  /** Ring colour around the presence dot: the background it sits on. */
  ring?: string;
}) {
  const [broken, setBroken] = useState(false);
  const showPhoto = src && !broken;
  return (
    <span className={`relative inline-flex shrink-0 ${SIZES[size]}`}>
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          onError={() => setBroken(true)}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-full w-full items-center justify-center rounded-full font-semibold tracking-wide text-white"
          style={{ background: tone(name || "?") }}
        >
          {initials(name)}
        </span>
      )}
      {online && (
        <span
          aria-label="Online"
          className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-live"
          style={{ boxShadow: `0 0 0 2.5px ${ring ?? "#fff"}` }}
        />
      )}
    </span>
  );
}
