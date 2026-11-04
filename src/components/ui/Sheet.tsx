"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "./icons";

/**
 * A panel that slides up from the bottom of the screen over a dimmed
 * backdrop, the way phone apps show details. Escape, the backdrop and the
 * close button all dismiss it.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const t = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div
        aria-hidden
        onClick={onClose}
        className={`absolute inset-0 bg-[rgba(10,14,20,0.42)] ${closing ? "anim-fade-out" : "anim-fade"}`}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative flex max-h-[88dvh] w-full flex-col rounded-t-[20px] bg-paper shadow-[0_-8px_30px_rgba(0,0,0,0.15)] outline-none ${
          closing ? "anim-sheet-down" : "anim-sheet-up"
        }`}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <span aria-hidden className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-field-off" />
          <h2 className="mt-3 text-[17px] font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="press mt-3 -mr-2 rounded-full p-2 text-muted hover:bg-canvas hover:text-ink"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="scroll-thin overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
