import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isSameOrigin, jsonError } from "./guard";
import { getSessionSecret } from "./secrets";

/**
 * Sign-in for the developer page at /developer, kept apart from the admin
 * app: its own cookie, sent only to /developer, lasting 12 hours.
 *
 * The password is DEVELOPER_PASSWORD, or ADMIN_PASSWORD until that is set.
 * Changing it signs the developer page out everywhere.
 */
export const DEV_COOKIE = "mwchat_dev";
export const DEV_HOURS = 12;

function sha256(text: string): Buffer {
  return createHash("sha256").update(text).digest();
}

function devPassword(): string | null {
  return process.env.DEVELOPER_PASSWORD || process.env.ADMIN_PASSWORD || null;
}

export function devConfigured(): boolean {
  return Boolean(devPassword());
}

export function devPasswordIsSeparate(): boolean {
  return Boolean(process.env.DEVELOPER_PASSWORD);
}

export function devPasswordMatches(input: string): boolean {
  const expected = devPassword();
  if (!expected || !input) return false;
  return timingSafeEqual(sha256(input), sha256(expected));
}

async function signingKey(): Promise<Buffer | null> {
  const password = devPassword();
  if (!password) return null;
  return sha256(`developer:${await getSessionSecret()}:${sha256(password).toString("hex")}`);
}

function sign(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export async function newDevSession(): Promise<string | null> {
  const key = await signingKey();
  if (!key) return null;
  const payload = `d1.${Date.now() + DEV_HOURS * 3_600_000}`;
  return `${payload}.${sign(payload, key)}`;
}

async function validDevSession(value: string | undefined): Promise<boolean> {
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
  return payload.startsWith("d1.") && Number.isFinite(expires) && expires > Date.now();
}

export async function isDeveloper(): Promise<boolean> {
  return validDevSession((await cookies()).get(DEV_COOKIE)?.value);
}

/** For /developer/api routes: null when allowed, otherwise the response to return. */
export async function devGuard(req: Request): Promise<Response | null> {
  if (req.method !== "GET" && !isSameOrigin(req)) return jsonError(403, "forbidden");
  if (!(await isDeveloper())) return jsonError(401, "signed_out");
  return null;
}

export function devCookie(req: Request, value: string, maxAge: number): string {
  return [
    `${DEV_COOKIE}=${value}`,
    "Path=/developer",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
    ...(new URL(req.url).protocol === "https:" ? ["Secure"] : []),
  ].join("; ");
}
