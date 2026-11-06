import webpush from "web-push";
import { db } from "./db";
import { getVapidKeys } from "./secrets";
import { logError } from "./log";

/**
 * Phone and desktop notifications to Michael, through the browser's own push
 * service (Web Push). Works in the installed chat app on Android, including
 * when it is wrapped as an APK, without a separate Firebase project.
 *
 * Sent as high urgency, which lets the phone's push service wake it from
 * battery saving, and kept for 24 hours if the phone is off or has no signal
 * (an alert for a lead is still worth having late). Every send is logged.
 */
export interface PushMessage {
  title: string;
  body: string;
  /** Opened when the notification is tapped. */
  url: string;
  /** Notifications with the same tag replace each other. */
  tag?: string;
}

export async function notifyAgent(message: PushMessage): Promise<void> {
  const subs = await db()`select endpoint, p256dh, auth from push_subscriptions`;
  if (subs.length === 0) return;
  const keys = await getVapidKeys();
  const options = {
    TTL: 24 * 60 * 60,
    urgency: "high" as const,
    vapidDetails: {
      subject: process.env.VAPID_SUBJECT ?? "https://westchesterguy.com",
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
    },
  };

  await Promise.all(
    subs.map(async (s) => {
      const started = Date.now();
      const service = new URL(s.endpoint).host;
      const record = (ok: boolean, status: number | null, error: string | null) =>
        db()`
          insert into push_log (title, service, status, ok, error, ms)
          values (${message.title}, ${service}, ${status}, ${ok}, ${error}, ${Date.now() - started})`.catch(() => {});
      try {
        const res = await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(message),
          options,
        );
        await record(true, res.statusCode, null);
      } catch (err) {
        // The device unsubscribed or the app was uninstalled: forget it.
        const status = (err as { statusCode?: number }).statusCode;
        await record(false, status ?? null, status === 404 || status === 410 ? "Device no longer signed up; removed." : (err as Error).message.slice(0, 200));
        if (status === 404 || status === 410) {
          await db()`delete from push_subscriptions where endpoint = ${s.endpoint}`;
        } else {
          await logError("push", `A notification could not be delivered (${status ?? (err as Error).name}).`, {
            status: status ?? null,
            service: new URL(s.endpoint).host,
          });
        }
      }
    }),
  );
  if (Math.random() < 0.02) await db()`delete from push_log where created_at < now() - interval '30 days'`.catch(() => {});
}
