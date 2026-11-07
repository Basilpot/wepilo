import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { app } from "@/app";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { hashPassword, signToken } from "@/lib/auth";

export const db = () => getDb(env);

let seq = 0;

/** An ENTERPRISE workspace has no end date, so the website API and dashboard are both open. */
export async function makeTenant() {
  seq += 1;
  const [tenant] = await db()
    .insert(schema.tenants)
    .values({
      email: `owner${seq}-${Date.now()}@test.dev`,
      password: await hashPassword("password123"),
      companyName: `Agency ${seq}`,
      slug: `agency-${seq}-${Date.now()}`,
      status: "ACTIVE",
      plan: "ENTERPRISE",
      billingMode: "MANUAL",
    })
    .returning();
  const [owner] = await db()
    .insert(schema.tenantStaff)
    .values({ tenantId: tenant.id, name: "Owner", email: tenant.email, password: tenant.password, role: "OWNER" })
    .returning();
  const token = await signToken(env, { kind: "staff", staffId: owner.id, tenantId: tenant.id, role: "OWNER" });
  return { tenant, owner, token };
}

export async function makeTrip(tenantId: number, opts: { capacity?: number; price?: number; startDate?: string } = {}) {
  const [activity] = await db()
    .insert(schema.activities)
    .values({ tenantId, title: "Everest Base Camp", slug: `ebc-${++seq}-${Date.now()}`, status: "PUBLISHED" })
    .returning();
  const capacity = opts.capacity ?? 4;
  const [departure] = await db()
    .insert(schema.departures)
    .values({
      tenantId,
      activityId: activity.id,
      startDate: opts.startDate ?? "2099-01-10",
      capacity,
      availableSpots: capacity,
      price: opts.price ?? 1000,
    })
    .returning();
  return { activity, departure };
}

type CallOpts = {
  method?: string;
  body?: unknown;
  /** Staff session token, sent as a cookie like the dashboard does. */
  staff?: string;
  /** Website access: tenant slug header. */
  slug?: string;
  headers?: Record<string, string>;
};

export async function call(path: string, opts: CallOpts = {}) {
  const headers = new Headers(opts.headers);
  if (opts.body !== undefined) headers.set("content-type", "application/json");
  if (opts.staff) headers.set("cookie", `wepilo_staff_token=${opts.staff}`);
  if (opts.slug) headers.set("x-tenant-slug", opts.slug);
  const ctx = createExecutionContext();
  const res = await app.fetch(
    new Request(`http://api.test${path}`, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    }),
    env,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text, headers: res.headers };
}
