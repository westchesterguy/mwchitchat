"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertIcon, ArrowDownIcon, CheckIcon, ClockIcon } from "../ui/icons";
import { clock, dayKey, dayLabel } from "./time";
import type { ChatMessage, Sender } from "./useMessages";

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
            className={`underline underline-offset-2 ${mine ? "decoration-white/60" : "text-navy decoration-navy/40"}`}
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
              <span className="rounded-full bg-[#e7e5df] px-3 py-1 text-[11px] font-medium text-muted">
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
                  <div
                    className={`whitespace-pre-wrap break-words rounded-[18px] px-3.5 py-2 text-[15px] leading-[1.4] ${corners} ${
                      isMine
                        ? `bg-navy text-white ${m.pending ? "opacity-80" : ""}`
                        : "bg-bubble text-ink shadow-[var(--shadow-bubble)]"
                    } ${m.failed ? "ring-1 ring-danger/50" : ""}`}
                  >
                    <Linked text={m.body} mine={isMine} />
                  </div>
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
                              <CheckIcon className="h-3.5 w-3.5 text-navy/60" strokeWidth={2} />
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
    </div>
  );
}
