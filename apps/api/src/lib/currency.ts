import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import * as schema from "@/db/schema";

/** The workspace's price currency and whether its website may show converted prices. */
export async function getSettings(db: Db, tenantId: number) {
  return db.query.tenantPaymentSettings.findFirst({ where: eq(schema.tenantPaymentSettings.tenantId, tenantId) });
}
