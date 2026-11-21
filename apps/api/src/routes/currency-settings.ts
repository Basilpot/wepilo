import { Hono } from "hono";
import { z } from "zod";
import * as schema from "@/db/schema";
import type { AppEnv } from "@/types";
import { requireStaff, requireTenant } from "@/middleware/context";
import { getSettings } from "@/lib/currency";

const CURRENCY = /^[A-Z]{3}$/;

const view = (s: schema.TenantPaymentSettings | undefined) => ({
  currency: s?.currency ?? "USD",
  currencyTranslation: s?.currencyTranslation ?? false,
});

/** The one currency every price in a workspace is entered in. Wepilo does not take payments. */
export const currencyRoutes = new Hono<AppEnv>()
  .get("/", requireStaff("OWNER", "ADMIN"), requireTenant(), async (c) => {
    return c.json(view(await getSettings(c.get("db"), c.get("tenantId"))));
  })
  .put("/", requireStaff("OWNER", "ADMIN"), requireTenant(), async (c) => {
    const body = z
      .object({
        currency: z.string().trim().toUpperCase().regex(CURRENCY, "must be a 3-letter currency code like USD").optional(),
        currencyTranslation: z.boolean().optional(),
      })
      .parse(await c.req.json());
    const db = c.get("db");
    const tenantId = c.get("tenantId");
    const values = {
      ...(body.currency !== undefined ? { currency: body.currency } : {}),
      ...(body.currencyTranslation !== undefined ? { currencyTranslation: body.currencyTranslation } : {}),
      updatedAt: new Date(),
    };
    await db
      .insert(schema.tenantPaymentSettings)
      .values({ tenantId, ...values })
      .onConflictDoUpdate({ target: schema.tenantPaymentSettings.tenantId, set: values });
    return c.json(view(await getSettings(db, tenantId)));
  });
