"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertIcon, ArrowDownIcon, CheckIcon, ClockIcon, CloseIcon, DownloadIcon, ExternalIcon, FileIcon, Spinner } from "../ui/icons";
import { fileSize } from "./attach";
import { clock, dayKey, dayLabel } from "./time";
import type { Attachment, ChatMessage, Sender } from "./useMessages";

const RUN_GAP_MS = 5 * 60_000;
const URL = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

function Linked({ text, mine }: { text: string; mine: boolean }) {
  const parts = text.split(URL);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline underline-offset-2 ${mine ? "decoration-white/60" : "text-accent decoration-navy/40"}`}
          >
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/** A photo's size in the thread: at most 240 wide and 300 tall, never thinner than 120. */
function fit(w: number | null, h: number | null): { width: number; height: number } {
  if (!w || !h) return { width: 240, height: 180 };
  let width = Math.min(240, w);
  let height = (width * h) / w;
  if (height > 300) {
    height = 300;
    width = Math.max(120, (height * w) / h);
  }
  return { width: Math.round(width), height: Math.round(height) };
}

function AttachmentView({
  a,
  mine,
  pending,
  failed,
  onOpen,
}: {
  a: Attachment;
  mine: boolean;
  pending?: boolean;
  failed?: boolean;
  onOpen: (a: Attachment) => void;
}) {
  const ring = failed ? "ring-1 ring-danger/50" : "";
  if (a.type.startsWith("image/")) {
    const size = fit(a.width, a.height);
    return (
      <button
        type="button"
        onClick={() => onOpen(a)}
        aria-label={`Open photo ${a.name}`}
        className={`press relative block overflow-hidden rounded-[18px] bg-chip shadow-[var(--shadow-bubble)] ${ring}`}
        style={size}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.url} alt={a.name} width={size.width} height={size.height} loading="lazy" className="h-full w-full object-cover" />
        {pending && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white">
            <Spinner className="h-6 w-6" />
          </span>
        )}
      </button>
    );
  }
  const body = (
    <>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${mine ? "bg-white/15" : "bg-navy-tint text-accent"}`}>
        {pending ? <Spinner className="h-5 w-5" /> : <FileIcon className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{a.name}</span>
        <span className={`block text-[12px] ${mine ? "text-white/70" : "text-muted"}`}>PDF &middot; {fileSize(a.size)}</span>
      </span>
    </>
  );
  const tile = `flex w-[240px] max-w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left ${
    mine ? "bg-navy text-white" : "bg-bubble text-ink shadow-[var(--shadow-bubble)]"
  } ${ring}`;
  return pending ? (
    <div className={`${tile} opacity-80`}>{body}</div>
  ) : (
    <a href={a.url} target="_blank" rel="noopener noreferrer" className={`press ${tile}`}>
      {body}
    </a>
  );
}

/** A photo full screen, with a way to open or save the original. */
function Lightbox({ a, onClose }: { a: Attachment; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const action = "press flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/15";
  return (
    <div role="dialog" aria-modal="true" aria-label={a.name} className="anim-fade fixed inset-0 z-50 flex flex-col bg-black/90" onClick={onClose}>
      <div className="flex items-center justify-end gap-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]" onClick={(e) => e.stopPropagation()}>
        {a.id && (
          <>
            <a href={a.url} target="_blank" rel="noopener noreferrer" aria-label="Open in a new tab" className={action}>
              <ExternalIcon className="h-5 w-5" />
            </a>
            <a href={a.url} download={a.name} aria-label="Save" className={action}>
              <DownloadIcon className="h-5 w-5" />
            </a>
          </>
        )}
        <button type="button" aria-label="Close" onClick={onClose} className={action}>
          <CloseIcon className="h-6 w-6" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.url} alt={a.name} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
      </div>
    </div>
  );
}

/**
 * The conversation itself: bubbles grouped into runs by sender, day
 * dividers, a time and delivery state under each run, and a jump-to-latest
 * button when new messages land while you are scrolled up.
 */
export function Thread({
  messages,
  mine,
  otherName,
  otherAvatar,
  onRetry,
  header,
}: {
  messages: ChatMessage[];
  /** Whose messages sit on the right in navy. */
  mine: Exclude<Sender, "system">;
  otherName: string;
  otherAvatar?: React.ReactNode;
  onRetry?: (m: ChatMessage) => void;
  /** Shown above the first message (an intro card, say). */
  header?: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const initial = useRef<Set<number> | null>(null);
  const nearBottom = useRef(true);
  const [unseen, setUnseen] = useState(false);
  const [viewing, setViewing] = useState<Attachment | null>(null);
  const count = messages.length;
  const last = messages[count - 1];

  if (initial.current === null && count > 0) initial.current = new Set(messages.map((m) => m.id));

  const toBottom = (smooth: boolean) => {
    const el = box.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  useLayoutEffect(() => {
    toBottom(false);
  }, []);

  useEffect(() => {
    if (!last) return;
    if (nearBottom.current || last.sender === mine) {
      toBottom(true);
      setUnseen(false);
    } else {
      setUnseen(true);
    }
  }, [count, last, mine]);

  const onScroll = () => {
    const el = box.current;
    if (!el) return;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom.current) setUnseen(false);
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={box}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        className="scroll-thin h-full overflow-y-auto px-3 py-4 sm:px-5"
      >
        {header}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const newDay = !prev || dayKey(prev.at) !== dayKey(m.at);
          const divider = newDay ? (
            <div className="my-4 flex justify-center">
              <span className="rounded-full bg-chip px-3 py-1 text-[11px] font-medium text-muted">
                {dayLabel(m.at)}
              </span>
            </div>
          ) : null;
          const animate = initial.current !== null && !initial.current.has(m.id);

          if (m.sender === "system") {
            return (
              <Fragment key={m.id}>
                {divider}
                <p className={`mx-auto my-3 max-w-[85%] text-center text-[12px] leading-snug text-muted ${animate ? "anim-fade" : ""}`}>
                  {m.body}
                </p>
              </Fragment>
            );
          }

          const isMine = m.sender === mine;
          const sameAsPrev =
            !newDay && prev && prev.sender === m.sender && new Date(m.at).getTime() - new Date(prev.at).getTime() < RUN_GAP_MS;
          const sameAsNext =
            next &&
            next.sender === m.sender &&
            dayKey(next.at) === dayKey(m.at) &&
            new Date(next.at).getTime() - new Date(m.at).getTime() < RUN_GAP_MS;
          const first = !sameAsPrev;
          const lastOfRun = !sameAsNext;

          // Bubbles in a run sit tight on the sender's side; the first keeps
          // its round top so the run reads as one block.
          const corners = isMine
            ? `${first ? "rounded-tr-[18px]" : "rounded-tr-[6px]"} rounded-br-[6px]`
            : `${first ? "rounded-tl-[18px]" : "rounded-tl-[6px]"} rounded-bl-[6px]`;

          return (
            <Fragment key={m.id}>
              {divider}
              <div className={`flex ${isMine ? "justify-end" : "justify-start"} ${first ? "mt-3" : "mt-[3px]"} ${animate ? "anim-rise" : ""}`}>
                {!isMine && otherAvatar && (
                  <div className="mr-2 flex w-8 shrink-0 items-end">{lastOfRun ? otherAvatar : null}</div>
                )}
                <div className={`flex max-w-[82%] flex-col sm:max-w-[72%] ${isMine ? "items-end" : "items-start"}`}>
                  {!isMine && first && (
                    <span className="mb-1 ml-3 text-[11px] font-medium text-muted">{otherName}</span>
                  )}
                  {m.attachment && (
                    <AttachmentView a={m.attachment} mine={isMine} pending={m.pending} failed={m.failed} onOpen={setViewing} />
                  )}
                  {!m.body && !m.attachment && (
                    <div className="rounded-[18px] border border-dashed border-line px-3.5 py-2 text-[13px] italic text-muted">
                      Attachment removed
                    </div>
                  )}
                  {m.body && (
                    <div
                      className={`whitespace-pre-wrap break-words rounded-[18px] px-3.5 py-2 text-[15px] leading-[1.4] ${corners} ${
                        isMine
                          ? `bg-navy text-white ${m.pending ? "opacity-80" : ""}`
                          : "bg-bubble text-ink shadow-[var(--shadow-bubble)]"
                      } ${m.failed ? "ring-1 ring-danger/50" : ""} ${m.attachment ? "mt-[3px]" : ""}`}
                    >
                      <Linked text={m.body} mine={isMine} />
                    </div>
                  )}
                  {lastOfRun && (
                    <span className="mx-1.5 mt-1 flex items-center gap-1 text-[11px] text-faint">
                      {m.failed ? (
                        <button
                          type="button"
                          onClick={() => onRetry?.(m)}
                          className="flex items-center gap-1 font-medium text-danger"
                        >
                          <AlertIcon className="h-3.5 w-3.5" /> Not sent. Tap to retry
                        </button>
                      ) : (
                        <>
                          {clock(m.at)}
                          {isMine &&
                            (m.pending ? (
                              <ClockIcon className="h-3 w-3" />
                            ) : (
                              <CheckIcon className="h-3.5 w-3.5 text-accent/60" strokeWidth={2} />
                            ))}
                        </>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
      {unseen && (
        <button
          type="button"
          onClick={() => {
            toBottom(true);
            setUnseen(false);
          }}
          className="press anim-pop absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-navy px-3.5 py-2 text-[12px] font-medium text-white shadow-[var(--shadow-float)]"
        >
          <ArrowDownIcon className="h-3.5 w-3.5" strokeWidth={2} /> New messages
        </button>
      )}
      {viewing && <Lightbox a={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
