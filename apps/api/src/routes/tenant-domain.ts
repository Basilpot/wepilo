import { Hono } from "hono";
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppEnv } from "@/types";
import { ApiError } from "@/lib/http";
import { requireStaff, requireTenant } from "@/middleware/context";
import { isPlatformHost, lookupTxt, normalizeDomain, verificationRecord, verificationValue } from "@/lib/domain";
import { enforce } from "@/lib/rate-limit";

async function view(c: { get: (k: "db") => import("@/db").Db }, tenantId: number) {
  const t = await c.get("db").query.tenants.findFirst({
    where: eq(schema.tenants.id, tenantId),
    columns: { customDomain: true, customDomainToken: true, customDomainVerifiedAt: true },
  });
  if (!t?.customDomain || !t.customDomainToken) return { domain: null };
  return {
    domain: t.customDomain,
    verified: Boolean(t.customDomainVerifiedAt),
    verifiedAt: t.customDomainVerifiedAt,
    record: { type: "TXT", name: verificationRecord(t.customDomain), value: verificationValue(t.customDomainToken) },
  };
}

/** The website's own domain. Verified domains let the site identify its agency without sending a key. */
export const domainRoutes = new Hono<AppEnv>()
  .use("*", requireStaff("OWNER", "ADMIN"), requireTenant())
  .get("/", async (c) => c.json(await view(c, c.get("tenantId"))))
  .put("/", async (c) => {
    const body = z.object({ domain: z.string().trim().min(1).max(300) }).parse(await c.req.json());
    const domain = normalizeDomain(body.domain);
    if (!domain) throw new ApiError(400, "domain: enter a domain like www.youragency.com", "VALIDATION");
    if (isPlatformHost(c.env, domain)) throw new ApiError(400, "domain: that address belongs to Wepilo", "VALIDATION");

    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const taken = await db.query.tenants.findFirst({
      where: and(eq(schema.tenants.customDomain, domain), ne(schema.tenants.id, tenantId)),
      columns: { id: true },
    });
    if (taken) throw new ApiError(409, "That domain is already connected to another workspace.", "DOMAIN_TAKEN");

    const current = await db.query.tenants.findFirst({ where: eq(schema.tenants.id, tenantId), columns: { customDomain: true } });
    if (current?.customDomain !== domain) {
      await db
        .update(schema.tenants)
        .set({
          customDomain: domain,
          customDomainToken: crypto.randomUUID().replace(/-/g, ""),
          customDomainVerifiedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.tenants.id, tenantId));
    }
    return c.json(await view(c, tenantId));
  })
  .post("/verify", async (c) => {
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    await enforce(db, { name: "domain-verify", max: 12, windowSeconds: 60 * 60 }, String(tenantId));
    const t = await db.query.tenants.findFirst({
      where: eq(schema.tenants.id, tenantId),
      columns: { customDomain: true, customDomainToken: true },
    });
    if (!t?.customDomain || !t.customDomainToken) throw new ApiError(400, "Add a domain first.", "NO_DOMAIN");

    let records: string[];
    try {
      records = await lookupTxt(verificationRecord(t.customDomain));
    } catch {
      throw new ApiError(502, "Couldn't check DNS right now. Try again in a minute.", "DNS_UNAVAILABLE");
    }
    if (!records.includes(verificationValue(t.customDomainToken))) {
      throw new ApiError(422, "We couldn't find the TXT record yet. DNS changes can take up to an hour to show up.", "DNS_NOT_FOUND");
    }
    await db.update(schema.tenants).set({ customDomainVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(schema.tenants.id, tenantId));
    return c.json(await view(c, tenantId));
  })
  .delete("/", async (c) => {
    await c
      .get("db")
      .update(schema.tenants)
      .set({ customDomain: null, customDomainToken: null, customDomainVerifiedAt: null, updatedAt: new Date() })
      .where(eq(schema.tenants.id, c.get("tenantId")));
    return c.json({ domain: null });
  });
