import { randomBytes } from "node:crypto";
import webpush from "web-push";
import { db } from "./db";

/**
 * Server-only keys, made on first use and kept in the settings table (which
 * row level security closes to Supabase's public API). Nobody has to create
 * them, paste them anywhere or see them. An environment variable of the same
 * purpose, if set, wins.
 */
async function stored<T>(key: string, make: () => T): Promise<T> {
  const [found] = await db()`select value from settings where key = ${key}`;
  if (found) return found.value as T;
  // Two first requests at once: the first insert wins and both read it back.
  await db()`
    insert into settings (key, value) values (${key}, ${db().json(make() as never)})
    on conflict (key) do nothing`;
  const [row] = await db()`select value from settings where key = ${key}`;
  return row.value as T;
}

let sessionSecret: Promise<string> | null = null;

/** Signs admin sign-in cookies. */
export function getSessionSecret(): Promise<string> {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) {
    return Promise.resolve(process.env.SESSION_SECRET);
  }
  sessionSecret ??= stored("session_secret", () => randomBytes(48).toString("base64url")).catch((err) => {
    sessionSecret = null;
    throw err;
  });
  return sessionSecret;
}

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

let vapid: Promise<VapidKeys> | null = null;

/** Identifies this app to browsers' push services for notifications. */
export function getVapidKeys(): Promise<VapidKeys> {
  const { NEXT_PUBLIC_VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey } = process.env;
  if (publicKey && privateKey) return Promise.resolve({ publicKey, privateKey });
  vapid ??= stored("vapid_keys", () => webpush.generateVAPIDKeys()).catch((err) => {
    vapid = null;
    throw err;
  });
  return vapid;
}
