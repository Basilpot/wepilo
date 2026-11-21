import { z } from "zod";
import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { ApiError } from "@/lib/http";

export type StaffRole = "OWNER" | "ADMIN" | "MANAGER" | "EDITOR" | "AUTHOR";

/**
 * Scheduling
 * ----------
 * A draft with a `publishAt` is scheduled. The publish job (cron, every 5 minutes) puts it
 * live once that time has passed, stamps `publishedAt` and clears `publishAt`. Publishing by
 * hand clears any schedule. Something already live can't be scheduled.
 */

/** ISO 8601 date-time from the client, e.g. 2027-01-12T09:00:00+01:00. `null` clears the schedule. */
export const publishAtInput = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? undefined : v === null ? null : new Date(v)));

/** Roles that may publish or schedule. Authors write; someone else puts their work live. */
export const PUBLISHERS: readonly StaffRole[] = ["OWNER", "ADMIN", "MANAGER", "EDITOR"];

export function assertCanPublish(role: StaffRole) {
  if (!PUBLISHERS.includes(role)) {
    throw new ApiError(403, "Authors can save drafts. Ask an editor, manager or owner to publish or schedule.", "CANNOT_PUBLISH");
  }
}

/**
 * Works out the publish fields for a write.
 * `goingLive`: the request publishes now. `wasLive`: the record was already published.
 */
export function publishFields(opts: { goingLive: boolean | undefined; wasLive: boolean; publishAt: Date | null | undefined }) {
  const { goingLive, wasLive, publishAt } = opts;
  if (goingLive) return { publishAt: null, ...(wasLive ? {} : { publishedAt: new Date() }) };
  if (publishAt !== undefined) {
    if (publishAt && wasLive) {
      throw new ApiError(409, "This is already live. Unpublish it first to schedule it.", "ALREADY_PUBLISHED");
    }
    return { publishAt };
  }
  return {};
}

/** Puts every scheduled draft whose time has come live. Safe to run as often as you like. */
export async function publishDue(db: Db, now = new Date()) {
  const [trips, posts, pages] = await Promise.all([
    db
      .update(schema.activities)
      .set({ status: "PUBLISHED", publishedAt: sql`${schema.activities.publishAt}`, publishAt: null, updatedAt: now })
      .where(and(isNotNull(schema.activities.publishAt), lte(schema.activities.publishAt, now), eq(schema.activities.status, "DRAFT")))
      .returning({ id: schema.activities.id }),
    db
      .update(schema.blogs)
      .set({ published: true, publishedAt: sql`${schema.blogs.publishAt}`, publishAt: null, updatedAt: now })
      .where(and(isNotNull(schema.blogs.publishAt), lte(schema.blogs.publishAt, now), eq(schema.blogs.published, false), eq(schema.blogs.inTrash, false)))
      .returning({ id: schema.blogs.id }),
    db
      .update(schema.infoPages)
      .set({ published: true, publishedAt: sql`${schema.infoPages.publishAt}`, publishAt: null, updatedAt: now })
      .where(and(isNotNull(schema.infoPages.publishAt), lte(schema.infoPages.publishAt, now), eq(schema.infoPages.published, false)))
      .returning({ id: schema.infoPages.id }),
  ]);
  return { trips: trips.length, posts: posts.length, pages: pages.length };
}
