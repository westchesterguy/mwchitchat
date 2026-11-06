"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon, FileIcon, PaperclipIcon, SendIcon, Spinner } from "../ui/icons";
import { ACCEPT, fileSize, prepareFile, type Outgoing } from "./attach";

/**
 * The reply bar: a paperclip for a photo or PDF, a rounded field that grows
 * with the text, and a round send button. On a computer Enter sends and
 * Shift+Enter starts a new line; on a phone the keyboard's return key adds a
 * line and the button sends, as in other messaging apps. A photo can also be
 * pasted or dropped onto the bar.
 */
export function Composer({
  onSend,
  placeholder = "Message",
  note,
  autoFocus,
  maxLength = 2000,
  attachments = true,
  actions,
  draft,
}: {
  onSend: (text: string, file: Outgoing | null) => void;
  /** Buttons beside the note above the field (Suggest a reply, say). */
  actions?: React.ReactNode;
  /** Text to put in the field, such as a suggested reply; a new `n` puts it in again. */
  draft?: { text: string; n: number } | null;
  placeholder?: string;
  note?: React.ReactNode;
  autoFocus?: boolean;
  maxLength?: number;
  attachments?: boolean;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<Outgoing | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const finePointer = useRef(true);

  useEffect(() => {
    if (draft) {
      setText(draft.text);
      field.current?.focus();
    }
  }, [draft]);

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

  const pick = async (chosen: File | undefined) => {
    if (!chosen || !attachments) return;
    setError(null);
    setPreparing(true);
    const result = await prepareFile(chosen);
    setPreparing(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFile((old) => {
      if (old) URL.revokeObjectURL(old.preview);
      return result.file;
    });
    if (finePointer.current) field.current?.focus();
  };

  const discard = () => {
    if (file) URL.revokeObjectURL(file.preview);
    setFile(null);
  };

  const submit = () => {
    const value = text.trim();
    if ((!value && !file) || preparing) return;
    // The preview address now belongs to the message being sent.
    onSend(value, file);
    setText("");
    setFile(null);
    setError(null);
    field.current?.focus();
  };

  const ready = (text.trim().length > 0 || file !== null) && !preparing;
  const isPhoto = file?.type.startsWith("image/");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onDragOver={(e) => {
        if (!attachments || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!attachments || !e.dataTransfer.files.length) return;
        e.preventDefault();
        setDragging(false);
        pick(e.dataTransfer.files[0]);
      }}
      className={`border-t bg-paper/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur transition-colors sm:px-4 ${
        dragging ? "border-navy/40 bg-navy-tint" : "border-line"
      }`}
    >
      {(note || actions) && (
        <div className="mb-2 flex items-center gap-2 px-1">
          <div className="min-w-0 flex-1 text-[12px] text-muted">{note}</div>
          {actions}
        </div>
      )}

      {(file || preparing || error) && (
        <div className="anim-rise mb-2 flex items-center gap-3 rounded-2xl border border-line bg-surface p-2 pr-1.5">
          {preparing ? (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-canvas text-faint">
              <Spinner className="h-5 w-5" />
            </span>
          ) : file && isPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={file.preview} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
          ) : file ? (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-navy-tint text-accent">
              <FileIcon className="h-6 w-6" />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            {error ? (
              <p className="px-1 text-[13px] text-danger">{error}</p>
            ) : preparing ? (
              <p className="text-[13px] text-muted">Preparing&hellip;</p>
            ) : file ? (
              <>
                <p className="truncate text-[14px] font-medium text-ink">{isPhoto ? "Photo" : file.name}</p>
                <p className="text-[12px] text-muted">{fileSize(file.blob.size)}</p>
              </>
            ) : null}
          </div>
          {!preparing && (
            <button
              type="button"
              aria-label={error ? "Dismiss" : "Remove attachment"}
              onClick={() => (error ? setError(null) : discard())}
              className="press shrink-0 self-start rounded-full p-1.5 text-muted hover:bg-canvas"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <div className="flex items-end gap-1.5 sm:gap-2">
        {attachments && (
          <>
            <input
              ref={picker}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              aria-label="Attach a photo or PDF"
              onClick={() => picker.current?.click()}
              disabled={preparing}
              className="press -ml-1 flex h-11 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-chip hover:text-ink-soft disabled:opacity-40"
            >
              <PaperclipIcon className="h-[22px] w-[22px]" />
            </button>
          </>
        )}
        <label className="sr-only" htmlFor="composer">
          {placeholder}
        </label>
        <textarea
          id="composer"
          ref={field}
          value={text}
          rows={1}
          maxLength={maxLength}
          placeholder={file ? "Add a caption" : placeholder}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            // A pasted screenshot or photo; pasted text is left alone.
            const pasted = e.clipboardData.files;
            if (attachments && pasted.length && !e.clipboardData.getData("text/plain")) {
              e.preventDefault();
              pick(pasted[0]);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && finePointer.current && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          className="max-h-[148px] min-h-[44px] min-w-0 flex-1 resize-none rounded-[22px] border border-line bg-surface px-4 py-[11px] text-[15px] leading-[1.4] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-navy/50 focus:shadow-[0_0_0_3px_rgba(0,35,73,0.08)]"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!ready}
          className={`press flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
            ready ? "bg-navy text-white shadow-[0_2px_8px_rgba(0,35,73,0.3)]" : "bg-field-off text-white"
          }`}
        >
          <SendIcon className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>
    </form>
  );
}
