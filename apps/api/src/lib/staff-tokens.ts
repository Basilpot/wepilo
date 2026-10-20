import { and, eq, gt, isNull } from "drizzle-orm";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { sha256Hex } from "@/lib/crypto";

const HOUR = 60 * 60 * 1000;

export const TOKEN_TTL: Record<"SETUP" | "RESET", number> = {
  SETUP: 7 * 24 * HOUR,
  RESET: HOUR,
};

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Create a single-use link token for a staff member. Any earlier unused token of the
 * same purpose stops working, so only the newest link is valid.
 */
export async function issueStaffToken(db: Db, staffId: number, purpose: "SETUP" | "RESET", now = Date.now()) {
  const token = randomToken();
  await db
    .update(schema.staffAuthTokens)
    .set({ usedAt: new Date(now) })
    .where(
      and(
        eq(schema.staffAuthTokens.staffId, staffId),
        eq(schema.staffAuthTokens.purpose, purpose),
        isNull(schema.staffAuthTokens.usedAt),
      ),
    );
  const expiresAt = new Date(now + TOKEN_TTL[purpose]);
  await db.insert(schema.staffAuthTokens).values({
    staffId,
    purpose,
    tokenHash: await sha256Hex(token),
    expiresAt,
  });
  return { token, expiresAt };
}

/** Find the staff member for a valid, unused token without using it up. */
export async function peekStaffToken(db: Db, token: string, now = Date.now()) {
  const row = await db.query.staffAuthTokens.findFirst({
    where: and(
      eq(schema.staffAuthTokens.tokenHash, await sha256Hex(token)),
      isNull(schema.staffAuthTokens.usedAt),
      gt(schema.staffAuthTokens.expiresAt, new Date(now)),
    ),
  });
  if (!row) return null;
  const staff = await db.query.tenantStaff.findFirst({ where: eq(schema.tenantStaff.id, row.staffId) });
  return staff ? { row, staff } : null;
}

/**
 * Set a staff password from a link token and burn every open link for that person.
 * The owner also signs in through the tenant record, so its password is kept in sync.
 */
export async function consumeStaffToken(db: Db, token: string, passwordHash: string, now = Date.now()) {
  const found = await peekStaffToken(db, token, now);
  if (!found) return null;
  const { staff } = found;
  const at = new Date(now);

  await db
    .update(schema.staffAuthTokens)
    .set({ usedAt: at })
    .where(and(eq(schema.staffAuthTokens.staffId, staff.id), isNull(schema.staffAuthTokens.usedAt)));
  await db
    .update(schema.tenantStaff)
    .set({ password: passwordHash, updatedAt: at })
    .where(eq(schema.tenantStaff.id, staff.id));

  if (staff.role === "OWNER") {
    await db
      .update(schema.tenants)
      .set({ password: passwordHash, updatedAt: at })
      .where(and(eq(schema.tenants.id, staff.tenantId), eq(schema.tenants.email, staff.email)));
  }
  return { staff, purpose: found.row.purpose };
}
