import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { count, eq } from "drizzle-orm";
import { dataDir, getDb } from "@/db";
import { users } from "@/db/schema";

const COOKIE = "mityaf_session";
const MAX_AGE = 60 * 60 * 24 * 30;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  partnerId: string | null;
};

let cachedSecret: Uint8Array | undefined;

/** AUTH_SECRET in production; a generated, persisted secret for zero-config local use. */
function secret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  let value = process.env.AUTH_SECRET?.trim();
  if (!value) {
    const file = path.join(dataDir(), "auth-secret");
    try {
      if (fs.existsSync(file)) {
        value = fs.readFileSync(file, "utf8").trim();
      } else {
        value = randomBytes(32).toString("base64");
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, value, { mode: 0o600 });
      }
    } catch {
      throw new Error("AUTH_SECRET is not set and no local secret could be created. Set AUTH_SECRET in the environment.");
    }
  }
  if (value.length < 16) throw new Error("AUTH_SECRET must be at least 16 characters.");
  cachedSecret = new TextEncoder().encode(value);
  return cachedSecret;
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** The signed-in user, re-checked against the database once per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  let uid: unknown;
  try {
    ({ uid } = (await jwtVerify(token, secret(), { algorithms: ["HS256"] })).payload);
  } catch {
    return null;
  }
  if (typeof uid !== "string") return null;
  const db = await getDb();
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, partnerId: users.partnerId })
    .from(users)
    .where(eq(users.id, uid))
    .limit(1);
  return user ?? null;
});

/** Call at the top of every page loader and Server Action. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("هذا الإجراء يتطلب صلاحية مدير.");
  return user;
}

export async function hasAnyUser(): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.select({ n: count() }).from(users);
  return (row?.n ?? 0) > 0;
}

// ── حدّ بسيط لمحاولات الدخول (داخل الذاكرة، لكل نسخة خادم) ──

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function loginThrottled(key: string): boolean {
  const entry = attempts.get(key);
  return !!entry && entry.resetAt > Date.now() && entry.count >= MAX_ATTEMPTS;
}
export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else entry.count += 1;
}
export function clearLoginFailures(key: string): void {
  attempts.delete(key);
}
