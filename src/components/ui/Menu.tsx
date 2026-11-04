"use client";

import { useEffect, useRef, useState } from "react";
import { MoreIcon } from "./icons";

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect?: () => void;
  href?: string;
  danger?: boolean;
}

/** A "more" button that opens a short list of actions. */
export function Menu({
  items,
  label = "More options",
  buttonClass = "text-ink-soft hover:bg-canvas",
}: {
  items: MenuItem[];
  label?: string;
  buttonClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent | TouchEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("touchstart", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`press rounded-full p-2 ${buttonClass}`}
      >
        <MoreIcon />
      </button>
      {open && (
        <div
          role="menu"
          className="anim-pop absolute right-0 top-full z-40 mt-1.5 min-w-[200px] origin-top-right overflow-hidden rounded-xl border border-line bg-surface py-1.5 text-ink shadow-[var(--shadow-card)]"
        >
          {items.map((item) => {
            const cls = `flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] hover:bg-canvas ${
              item.danger ? "text-danger" : ""
            }`;
            return item.href ? (
              <a key={item.label} role="menuitem" href={item.href} className={cls} onClick={() => setOpen(false)}>
                {item.icon}
                {item.label}
              </a>
            ) : (
              <button
                key={item.label}
                role="menuitem"
                type="button"
                className={cls}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
