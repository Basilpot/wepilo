import { and, asc, eq, inArray, ne } from "drizzle-orm";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { accessFor } from "@/lib/billing";

/**
 * One person may hold several Wepilo logins: one row in tenant_staff per workspace, all
 * sharing an email and a password. The email is the account; the rows are the memberships.
 */

/** Every workspace this person is staff in, oldest first. */
export async function membershipsFor(db: Db, email: string) {
  return db.query.tenantStaff.findMany({
    where: eq(schema.tenantStaff.email, email),
    orderBy: [asc(schema.tenantStaff.id)],
  });
}

/**
 * True when this email already has a Wepilo login. With `exceptTenantId`, a login in that
 * workspace doesn't count: it is this person's own membership there.
 */
export async function hasAccount(db: Db, email: string, exceptTenantId?: number) {
  const row = await db.query.tenantStaff.findFirst({
    where:
      exceptTenantId === undefined
        ? eq(schema.tenantStaff.email, email)
        : and(eq(schema.tenantStaff.email, email), ne(schema.tenantStaff.tenantId, exceptTenantId)),
    columns: { id: true },
  });
  return Boolean(row);
}

export type WorkspaceSummary = {
  id: number;
  companyName: string | null;
  slug: string;
  /** The person's role in this workspace. */
  role: string;
  status: string;
  plan: string;
  /** Plan state: TRIAL, ACTIVE, PAST_DUE, EXPIRED or UNPAID. */
  access: string;
  locked: boolean;
};

/** The workspaces this person can open, with the state of each one's plan. */
export async function workspacesFor(db: Db, email: string): Promise<WorkspaceSummary[]> {
  const staff = await membershipsFor(db, email);
  const ids = [...new Set(staff.map((s) => s.tenantId))];
  if (!ids.length) return [];
  const [tenants, subs] = await Promise.all([
    db.query.tenants.findMany({ where: inArray(schema.tenants.id, ids) }),
    db.query.platformSubscriptions.findMany({ where: inArray(schema.platformSubscriptions.tenantId, ids) }),
  ]);
  const subByTenant = new Map(subs.map((s) => [s.tenantId, s]));
  const staffByTenant = new Map(staff.map((s) => [s.tenantId, s]));
  return tenants
    .map((t) => {
      const access = accessFor(t, subByTenant.get(t.id));
      return {
        id: t.id,
        companyName: t.companyName,
        slug: t.slug,
        role: staffByTenant.get(t.id)?.role ?? "EDITOR",
        status: t.status,
        plan: access.plan,
        access: access.state,
        locked: access.locked,
      };
    })
    .sort((a, b) => a.id - b.id);
}
