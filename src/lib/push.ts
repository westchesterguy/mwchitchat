import webpush from "web-push";
import { db } from "./db";
import { getVapidKeys } from "./secrets";

/**
 * Phone and desktop notifications to Michael, through the browser's own push
 * service (Web Push). Works in the installed admin app on Android, including
 * when it is wrapped as an APK, without a separate Firebase project.
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
    TTL: 60 * 60,
    urgency: "high" as const,
    vapidDetails: {
      subject: process.env.VAPID_SUBJECT ?? "https://westchesterguy.com",
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
    },
  };

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(message),
          options,
        );
      } catch (err) {
        // The device unsubscribed or the app was uninstalled: forget it.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db()`delete from push_subscriptions where endpoint = ${s.endpoint}`;
        } else {
          console.error(JSON.stringify({ pushError: status ?? (err as Error).name }));
        }
      }
    }),
  );
}
