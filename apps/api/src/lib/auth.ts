import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { setCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";

const STAFF_COOKIE = "narfu_staff_token";
const USER_COOKIE = "narfu_user_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export type StaffTokenPayload = {
  kind: "staff";
  staffId: number;
  tenantId: number;
  role: "OWNER" | "ADMIN" | "MANAGER" | "EDITOR";
};

export type UserTokenPayload = {
  kind: "user";
  userId: number;
  tenantId: number;
};

export type TokenPayload = StaffTokenPayload | UserTokenPayload;

function secret(env: { JWT_SECRET: string }) {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function signToken(env: { JWT_SECRET: string }, payload: TokenPayload) {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret(env));
}

export async function verifyToken<T extends TokenPayload>(
  env: { JWT_SECRET: string },
  token: string,
): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secret(env));
    return payload as unknown as T;
  } catch {
    return null;
  }
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

function cookieOptions(isSecure: boolean) {
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? ("None" as const) : ("Lax" as const),
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

export function setStaffAuthCookie(c: Context, token: string) {
  setCookie(c, STAFF_COOKIE, token, {
    ...cookieOptions(c.env.ENVIRONMENT === "production"),
    domain: c.env.ENVIRONMENT === "production" ? c.env.COOKIE_DOMAIN : undefined,
  });
}

export function setUserAuthCookie(c: Context, token: string) {
  setCookie(c, USER_COOKIE, token, {
    ...cookieOptions(c.env.ENVIRONMENT === "production"),
    domain: c.env.ENVIRONMENT === "production" ? c.env.COOKIE_DOMAIN : undefined,
  });
}

export function clearAuthCookies(c: Context) {
  const opts = {
    domain: c.env.ENVIRONMENT === "production" ? c.env.COOKIE_DOMAIN : undefined,
    path: "/",
  };
  deleteCookie(c, STAFF_COOKIE, opts);
  deleteCookie(c, USER_COOKIE, opts);
}

export const staffCookieName = STAFF_COOKIE;
export const userCookieName = USER_COOKIE;
