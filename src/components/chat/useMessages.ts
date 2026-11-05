"use client";

import { useCallback, useRef, useState } from "react";
import type { Outgoing } from "./attach";

export type Sender = "visitor" | "agent" | "system";

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  width: number | null;
  height: number | null;
  url: string;
}

export interface ChatMessage {
  id: number;
  sender: Sender;
  body: string;
  at: string;
  attachment?: Attachment | null;
  /** Shown straight away while it is being sent (temporary negative id). */
  pending?: boolean;
  failed?: boolean;
  /** The file being sent, kept so a failed send can be retried. */
  outgoing?: Outgoing | null;
}

/**
 * The messages of one chat as the screen shows them: what the server has
 * sent, plus your own messages shown the instant you send them and
 * replaced by the server's copy when it arrives.
 */
export function useMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const lastId = useRef(0);

  const merge = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    lastId.current = Math.max(lastId.current, ...incoming.map((m) => m.id));
    setMessages((prev) => {
      let next = prev;
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      if (!fresh.length) return prev;
      // A poll can deliver our own message before the send call returns:
      // the optimistic copy then gives way to the real one.
      for (const m of fresh) {
        const i = next.findIndex(
          (p) => p.pending && p.sender === m.sender && p.body === m.body && Boolean(p.outgoing) === Boolean(m.attachment),
        );
        if (i >= 0) next = [...next.slice(0, i), ...next.slice(i + 1)];
      }
      return [...next, ...fresh];
    });
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    lastId.current = 0;
  }, []);

  const optimistic = useCallback((sender: Sender, body: string, file: Outgoing | null = null): number => {
    const id = -Date.now() - Math.random();
    const attachment: Attachment | null = file
      ? { id: "", name: file.name, type: file.type, size: file.blob.size, width: file.width, height: file.height, url: file.preview }
      : null;
    setMessages((prev) => [
      ...prev,
      { id, sender, body, at: new Date().toISOString(), attachment, outgoing: file, pending: true },
    ]);
    return id;
  }, []);

  /** The send finished: swap in the server's copy, or mark it failed. */
  const settle = useCallback(
    (tempId: number, real: ChatMessage | null) => {
      if (real) {
        setMessages((prev) => {
          const preview = prev.find((m) => m.id === tempId)?.outgoing?.preview;
          if (preview) setTimeout(() => URL.revokeObjectURL(preview), 30_000);
          return prev.filter((m) => m.id !== tempId);
        });
        merge([real]);
      } else {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)));
      }
    },
    [merge],
  );

  const remove = useCallback((id: number) => setMessages((prev) => prev.filter((m) => m.id !== id)), []);

  return { messages, lastId, merge, reset, optimistic, settle, remove };
}
