"use client";

import { useEffect, useState } from "react";
import type { ChatSettings } from "@/lib/chat-settings";
import { Spinner } from "../ui/icons";
import { devApi, primary, secondary } from "./api";

export type { ChatSettings };

/**
 * The chat settings as the developer page edits them: loaded once, changed
 * locally, saved whole. Shared by the Chat settings and Button & greeting tabs.
 */
export function useChatSettings() {
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [defaults, setDefaults] = useState<ChatSettings | null>(null);
  const [sites, setSites] = useState<{ id: string; domain: string }[]>([]);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    devApi<{ settings: ChatSettings; defaults: ChatSettings; sites: { id: string; domain: string }[] }>("settings").then(
      ({ ok, data }) => {
        if (!ok) return;
        setSettings(data.settings);
        setDefaults(data.defaults);
        setSites(data.sites);
        setSaved(JSON.stringify(data.settings));
      },
    );
  }, []);

  const dirty = settings !== null && JSON.stringify(settings) !== saved;

  const set = (patch: Partial<ChatSettings>) => {
    setMessage(null);
    setSettings((s) => (s ? { ...s, ...patch } : s));
  };

  const save = async () => {
    if (!settings) return;
    setBusy(true);
    const { ok, data } = await devApi<{ settings: ChatSettings; message?: string }>("settings", "PUT", { settings });
    setBusy(false);
    if (ok) {
      setSettings(data.settings);
      setSaved(JSON.stringify(data.settings));
      setMessage({ ok: true, text: "Saved. The sites pick this up within a minute." });
    } else {
      setMessage({ ok: false, text: data.message ?? "Could not save. Try again." });
    }
  };

  return {
    settings,
    defaults,
    sites,
    set,
    dirty,
    busy,
    message,
    setMessage,
    save,
    discard: () => setSettings(JSON.parse(saved)),
  };
}

export type SettingsState = ReturnType<typeof useChatSettings>;

/** The bar along the bottom while there are unsaved changes, and the result of saving. */
export function SaveBar({ state, onRestore }: { state: SettingsState; onRestore?: () => void }) {
  const { dirty, message, busy, save, discard } = state;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {onRestore && (
          <button type="button" className={secondary} onClick={onRestore}>
            Restore defaults
          </button>
        )}
        {message && !dirty && <p className={`text-[14px] ${message.ok ? "text-ok" : "text-danger"}`}>{message.text}</p>}
      </div>

      {dirty && (
        <div className="anim-rise fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-[1240px] items-center gap-3 sm:px-2">
            <p className="flex-1 text-[14px] text-ink-soft">
              {message && !message.ok ? <span className="text-danger">{message.text}</span> : "You have unsaved changes."}
            </p>
            <button type="button" className={secondary} onClick={discard}>
              Discard
            </button>
            <button type="button" className={primary} onClick={save} disabled={busy}>
              {busy && <Spinner />} Save
            </button>
          </div>
        </div>
      )}
    </>
  );
}
