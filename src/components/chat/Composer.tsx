"use client";

import { useEffect, useRef, useState } from "react";
import { SendIcon } from "../ui/icons";

/**
 * The reply bar: a rounded field that grows with the text, and a round send
 * button. On a computer Enter sends and Shift+Enter starts a new line; on a
 * phone the keyboard's return key adds a line and the button sends, as in
 * other messaging apps.
 */
export function Composer({
  onSend,
  placeholder = "Message",
  note,
  autoFocus,
  maxLength = 2000,
}: {
  onSend: (text: string) => void;
  placeholder?: string;
  note?: React.ReactNode;
  autoFocus?: boolean;
  maxLength?: number;
}) {
  const [text, setText] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const finePointer = useRef(true);

  useEffect(() => {
    finePointer.current = window.matchMedia("(pointer: fine)").matches;
    if (autoFocus && finePointer.current) field.current?.focus();
  }, [autoFocus]);

  // Grow with the text, up to about six lines.
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 148)}px`;
  }, [text]);

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText("");
    field.current?.focus();
  };

  const ready = text.trim().length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="border-t border-line bg-paper/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur sm:px-4"
    >
      {note && <div className="mb-2 px-1 text-[12px] text-muted">{note}</div>}
      <div className="flex items-end gap-2">
        <label className="sr-only" htmlFor="composer">
          {placeholder}
        </label>
        <textarea
          id="composer"
          ref={field}
          value={text}
          rows={1}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && finePointer.current && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          className="max-h-[148px] min-h-[44px] flex-1 resize-none rounded-[22px] border border-line bg-white px-4 py-[11px] text-[15px] leading-[1.4] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-navy/50 focus:shadow-[0_0_0_3px_rgba(0,35,73,0.08)]"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!ready}
          className={`press flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
            ready ? "bg-navy text-white shadow-[0_2px_8px_rgba(0,35,73,0.3)]" : "bg-[#dcdad3] text-white"
          }`}
        >
          <SendIcon className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>
    </form>
  );
}
