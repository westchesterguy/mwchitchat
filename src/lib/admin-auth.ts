import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isSameOrigin, jsonError } from "./guard";
import { getSessionSecret } from "./secrets";

/**
 * One admin login: the password in ADMIN_PASSWORD, set by Michael in Vercel.
 *
 * A successful login gets a signed cookie valid for 30 days. The signing key
 * folds in the password itself, so changing ADMIN_PASSWORD signs every
 * device out.
 */
export const SESSION_COOKIE = "mwchat_admin";
export const SESSION_DAYS = 30;

function sha256(text: string): Buffer {
  return createHash("sha256").update(text).digest();
}

async function signingKey(): Promise<Buffer | null> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  const secret = await getSessionSecret();
  return sha256(`${secret}:${sha256(password).toString("hex")}`);
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function passwordMatches(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !input) return false;
  return timingSafeEqual(sha256(input), sha256(expected));
}

function sign(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export async function newSession(): Promise<string | null> {
  const key = await signingKey();
  if (!key) return null;
  const payload = `v1.${Date.now() + SESSION_DAYS * 86_400_000}`;
  return `${payload}.${sign(payload, key)}`;
}

export async function validSession(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const key = await signingKey();
  if (!key) return false;
  const i = value.lastIndexOf(".");
  if (i < 0) return false;
  const payload = value.slice(0, i);
  const given = Buffer.from(value.slice(i + 1));
  const expected = Buffer.from(sign(payload, key));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  const expires = Number(payload.split(".")[1]);
  return Number.isFinite(expires) && expires > Date.now();
}

export async function isAdmin(): Promise<boolean> {
  return validSession((await cookies()).get(SESSION_COOKIE)?.value);
}

/**
 * For admin API routes: null when the caller is signed in (and, for anything
 * but a read, calling from this app), otherwise the error response to return.
 */
export async function adminGuard(req: Request): Promise<Response | null> {
  if (req.method !== "GET" && !isSameOrigin(req)) return jsonError(403, "forbidden");
  if (!(await isAdmin())) return jsonError(401, "signed_out");
  return null;
}
