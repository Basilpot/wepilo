import { Hono } from "hono";
import { z } from "zod";
import { and, asc, between, eq, isNotNull, or } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppEnv } from "@/types";
import { ApiError } from "@/lib/http";
import { requireStaff, requireTenant } from "@/middleware/context";
import { isIsoDate } from "@/lib/dates";

const isoDate = z.string().refine(isIsoDate, "must be a date like 2026-09-14");
const MAX_DAYS = 120;

export type CalendarItem = {
  kind: "trip" | "post" | "page" | "departure";
  id: number;
  title: string | null;
  /** When it happens: the publish time for content, the start date for a departure (ISO). */
  at: string;
  state: "scheduled" | "published" | "open" | "full" | "delayed";
  /** Departures only: the trip they belong to and the seats. */
  tripId?: number;
  seatsLeft?: number;
  capacity?: number;
  endDate?: string | null;
};

/**
 * The content calendar: everything scheduled or published in a date range, and every
 * departure in it, in time order. Rescheduling is done by saving the item with a new publishAt.
 */
export const calendarRoutes = new Hono<AppEnv>().get("/", requireStaff(), requireTenant(), async (c) => {
  const q = z.object({ from: isoDate, to: isoDate }).parse(c.req.query());
  if (q.to < q.from) throw new ApiError(400, "to: can't be before from", "VALIDATION");
  const from = new Date(`${q.from}T00:00:00Z`);
  const to = new Date(`${q.to}T23:59:59.999Z`);
  if ((to.getTime() - from.getTime()) / 86_400_000 > MAX_DAYS) {
    throw new ApiError(400, `Ask for ${MAX_DAYS} days or fewer at a time.`, "VALIDATION");
  }
  const db = c.get("db");
  const tenantId = c.get("tenantId");
  const A = schema.activities;
  const B = schema.blogs;
  const P = schema.infoPages;
  const D = schema.departures;

  const [trips, posts, pages, departures] = await Promise.all([
    db
      .select({ id: A.id, title: A.title, status: A.status, publishAt: A.publishAt, publishedAt: A.publishedAt })
      .from(A)
      .where(and(eq(A.tenantId, tenantId), or(between(A.publishAt, from, to), and(eq(A.status, "PUBLISHED"), between(A.publishedAt, from, to))))),
    db
      .select({ id: B.id, title: B.title, published: B.published, publishAt: B.publishAt, publishedAt: B.publishedAt })
      .from(B)
      .where(and(eq(B.tenantId, tenantId), eq(B.inTrash, false), or(between(B.publishAt, from, to), and(eq(B.published, true), between(B.publishedAt, from, to))))),
    db
      .select({ id: P.id, title: P.title, published: P.published, publishAt: P.publishAt, publishedAt: P.publishedAt })
      .from(P)
      .where(and(eq(P.tenantId, tenantId), or(between(P.publishAt, from, to), and(eq(P.published, true), isNotNull(P.publishedAt), between(P.publishedAt, from, to))))),
    db.query.departures.findMany({
      where: and(eq(D.tenantId, tenantId), between(D.startDate, q.from, q.to)),
      with: { activity: { columns: { id: true, title: true } } },
      orderBy: [asc(D.startDate)],
    }),
  ]);

  const items: CalendarItem[] = [];
  const content = (kind: "trip" | "post" | "page", r: { id: number; title: string | null; publishAt: Date | null; publishedAt: Date | null }, live: boolean) => {
    if (r.publishAt && !live) items.push({ kind, id: r.id, title: r.title, at: r.publishAt.toISOString(), state: "scheduled" });
    else if (r.publishedAt && live) items.push({ kind, id: r.id, title: r.title, at: r.publishedAt.toISOString(), state: "published" });
  };
  for (const t of trips) content("trip", t, t.status === "PUBLISHED");
  for (const p of posts) content("post", p, p.published);
  for (const p of pages) content("page", p, p.published);
  for (const d of departures) {
    items.push({
      kind: "departure",
      id: d.id,
      title: d.activity?.title ?? null,
      at: `${d.startDate}T00:00:00.000Z`,
      state: d.status === "FULL" ? "full" : d.status === "DELAYED" ? "delayed" : "open",
      tripId: d.activity?.id,
      seatsLeft: d.availableSpots,
      capacity: d.capacity,
      endDate: d.endDate,
    });
  }
  items.sort((a, b) => a.at.localeCompare(b.at));
  return c.json({ from: q.from, to: q.to, items });
});
