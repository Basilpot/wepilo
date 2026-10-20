import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { setCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";

const STAFF_COOKIE = "wepilo_staff_token";
const USER_COOKIE = "wepilo_user_token";
const PLATFORM_COOKIE = "wepilo_platform_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export type StaffTokenPayload = {
  kind: "staff";
  staffId: number;
  tenantId: number;
  role: "OWNER" | "ADMIN" | "MANAGER" | "EDITOR";
  /** Set when a platform admin opened this workspace as its owner. */
  impersonatedBy?: number;
};

export type UserTokenPayload = {
  kind: "user";
  userId: number;
  tenantId: number;
};

export type PlatformTokenPayload = {
  kind: "platform";
  adminId: number;
};

export type TokenPayload = StaffTokenPayload | UserTokenPayload | PlatformTokenPayload;

function secret(env: { JWT_SECRET: string }) {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function signToken(env: { JWT_SECRET: string }, payload: TokenPayload, expiresIn = "7d") {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
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

function cookieOptions(isSecure: boolean, maxAge = COOKIE_MAX_AGE) {
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? ("None" as const) : ("Lax" as const),
    path: "/",
    maxAge,
  };
}

export function setStaffAuthCookie(c: Context, token: string, maxAge?: number) {
  setCookie(c, STAFF_COOKIE, token, {
    ...cookieOptions(c.env.ENVIRONMENT === "production", maxAge),
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

/** Platform admin session: 12 hours, separate from any workspace session. */
const PLATFORM_MAX_AGE = 60 * 60 * 12;

export function setPlatformAuthCookie(c: Context, token: string) {
  setCookie(c, PLATFORM_COOKIE, token, {
    ...cookieOptions(c.env.ENVIRONMENT === "production", PLATFORM_MAX_AGE),
    domain: c.env.ENVIRONMENT === "production" ? c.env.COOKIE_DOMAIN : undefined,
  });
}

export function clearPlatformAuthCookie(c: Context) {
  deleteCookie(c, PLATFORM_COOKIE, {
    domain: c.env.ENVIRONMENT === "production" ? c.env.COOKIE_DOMAIN : undefined,
    path: "/",
  });
}

export const platformCookieName = PLATFORM_COOKIE;
export const staffCookieName = STAFF_COOKIE;
export const userCookieName = USER_COOKIE;
