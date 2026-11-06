"use client";

import { Switch } from "../ui/Switch";
import { card, h2, input, sub } from "./api";
import { SaveBar, useChatSettings } from "./useChatSettings";

const EMAIL_NOTE = "If you need to go, Michael's reply will also be sent to your email.";

function Row({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 border-t border-line py-3.5 first:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-ink">{title}</p>
        {note && <p className="mt-0.5 text-[13px] text-muted">{note}</p>}
      </div>
      {children}
    </div>
  );
}

/** How chats behave: away message, rescue, emailed replies, attachments, auto-close. The greeting and button are on their own tab. */
export function ChatSettingsPanel() {
  const state = useChatSettings();
  const { settings, defaults, set, setMessage } = state;

  if (!settings || !defaults) {
    return (
      <div className={card} aria-busy>
        <span className="skeleton block h-5 w-40" />
        <span className="skeleton mt-4 block h-32 w-full !rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className={h2}>Away message</h2>
        <p className={sub}>Posted in a new chat that starts while you&rsquo;re set to Away.</p>
        <textarea
          rows={3}
          value={settings.awayMessage}
          maxLength={400}
          onChange={(e) => set({ awayMessage: e.target.value })}
          className={`${input} mt-3 h-auto w-full resize-y py-2 leading-snug`}
        />
      </section>

      <section className={card}>
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h2 className={h2}>Rescue when you can&rsquo;t answer</h2>
            <p className={sub}>
              While you&rsquo;re online, if a visitor waits this long after their last message with no reply, this message is posted
              in the chat. Once per chat until you reply. Chats that start while you&rsquo;re away get the away message instead.
            </p>
          </div>
          <Switch
            checked={settings.rescue.enabled}
            onChange={(v) => set({ rescue: { ...settings.rescue, enabled: v } })}
            label="Rescue unanswered chats"
          />
        </div>
        <div className={`mt-3 space-y-3 ${settings.rescue.enabled ? "" : "opacity-50"}`}>
          <label className="flex flex-wrap items-center gap-3 text-[14px] text-ink">
            Step in after
            <input
              type="number"
              min={1}
              max={60}
              value={settings.rescue.minutes}
              onChange={(e) => set({ rescue: { ...settings.rescue, minutes: Number(e.target.value) } })}
              className={`${input} w-20 text-center`}
            />
            minutes without a reply.
          </label>
          <label className="block">
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-medium text-ink">Rescue message</span>
              <span className="text-[11px] tabular-nums text-faint">{settings.rescue.message.length}/400</span>
            </span>
            <textarea
              rows={3}
              maxLength={400}
              value={settings.rescue.message}
              onChange={(e) => set({ rescue: { ...settings.rescue, message: e.target.value } })}
              className={`${input} mt-1 h-auto w-full resize-y py-2 leading-snug`}
            />
          </label>
          <Row title="Alert me again when it steps in" note="A second notification on your phone, and an email to your lead addresses.">
            <Switch
              checked={settings.rescue.alert}
              onChange={(v) => set({ rescue: { ...settings.rescue, alert: v } })}
              label="Alert me again when it steps in"
            />
          </Row>
        </div>
        <div className="mt-1 border-t border-line pt-1">
          <Row
            title="Email my replies to visitors who have left"
            note={
              <>
                If a visitor has left the site when you reply, what you wrote is emailed to them half a minute later, with a link
                back to the chat. Their email replies come to your first lead address. When this is on and the visitor gave an
                email, the away and rescue messages end with: &ldquo;{EMAIL_NOTE}&rdquo;
              </>
            }
          >
            <Switch checked={settings.emailReplies} onChange={(v) => set({ emailReplies: v })} label="Email my replies to visitors who have left" />
          </Row>
        </div>
      </section>

      <section className={card}>
        <h2 className={h2}>Chat behaviour</h2>
        <div className="mt-2">
          <Row title="Visitors can send photos and PDFs" note="You can always send them.">
            <Switch checked={settings.visitorAttachments} onChange={(v) => set({ visitorAttachments: v })} label="Visitors can send photos and PDFs" />
          </Row>
          <Row title="Files a visitor can send in one chat" note="Stops one visitor filling the database.">
            <input
              type="number"
              min={1}
              max={200}
              value={settings.visitorFilesPerChat}
              disabled={!settings.visitorAttachments}
              onChange={(e) => set({ visitorFilesPerChat: Number(e.target.value) })}
              className={`${input} w-20 text-center disabled:opacity-50`}
            />
          </Row>
          <Row title="Close quiet chats after" note="Days with no messages. 0 keeps chats open until you close them.">
            <span className="flex items-center gap-2 text-[14px] text-ink-soft">
              <input
                type="number"
                min={0}
                max={365}
                value={settings.autoCloseDays}
                onChange={(e) => set({ autoCloseDays: Number(e.target.value) })}
                className={`${input} w-20 text-center`}
              />
              days
            </span>
          </Row>
        </div>
      </section>

      <SaveBar
        state={state}
        onRestore={() => {
          set({
            awayMessage: defaults.awayMessage,
            rescue: defaults.rescue,
            emailReplies: defaults.emailReplies,
            visitorAttachments: defaults.visitorAttachments,
            visitorFilesPerChat: defaults.visitorFilesPerChat,
            autoCloseDays: defaults.autoCloseDays,
          });
          setMessage({ ok: true, text: "Defaults filled in. Save to use them." });
        }}
      />
    </div>
  );
}
