import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { call, db, makeTenant, makeTrip } from "./helpers";

const traveller = { name: "Asha", email: "asha@example.com", phone: "+977 9800000000" };

async function book(slug: string, activityId: number, departureId: number, groupSize = 2, extra: object = {}) {
  return call("/api/v1/bookings", { slug, body: { activityId, departureId, groupSize, ...traveller, ...extra } });
}

const spots = async (id: number) =>
  (await db().query.departures.findFirst({ where: eq(schema.departures.id, id) }))!;

describe("booking lifecycle", () => {
  it("prices the booking server-side and holds no seats until confirmed", async () => {
    const { tenant, token } = await makeTenant();
    const { activity, departure } = await makeTrip(tenant.id, { price: 1200, capacity: 4 });

    const res = await book(tenant.slug, activity.id, departure.id, 3);
    expect(res.status).toBe(201);
    expect(res.json.booking.totalPrice).toBe(3600);
    expect((await spots(departure.id)).availableSpots).toBe(4);

    const ok = await call(`/api/v1/bookings/${res.json.booking.id}/status`, {
      method: "PATCH",
      staff: token,
      body: { status: "CONFIRMED" },
    });
    expect(ok.status).toBe(200);
    expect((await spots(departure.id)).availableSpots).toBe(1);
  });

  it("marks the departure FULL at zero spots and reopens it on cancel", async () => {
    const { tenant, token } = await makeTenant();
    const { activity, departure } = await makeTrip(tenant.id, { capacity: 2 });
    const b = (await book(tenant.slug, activity.id, departure.id, 2)).json.booking;

    await call(`/api/v1/bookings/${b.id}/status`, { method: "PATCH", staff: token, body: { status: "CONFIRMED" } });
    expect((await spots(departure.id)).status).toBe("FULL");
    expect((await book(tenant.slug, activity.id, departure.id, 1)).status).toBe(409);

    await call(`/api/v1/bookings/${b.id}/status`, { method: "PATCH", staff: token, body: { status: "CANCELLED" } });
    const after = await spots(departure.id);
    expect(after.availableSpots).toBe(2);
    expect(after.status).toBe("OPEN");
  });

  it("cancelling a pending booking does not hand back seats it never held", async () => {
    const { tenant, token } = await makeTenant();
    const { activity, departure } = await makeTrip(tenant.id, { capacity: 4 });
    const confirmed = (await book(tenant.slug, activity.id, departure.id, 2)).json.booking;
    const pending = (await book(tenant.slug, activity.id, departure.id, 2)).json.booking;
    await call(`/api/v1/bookings/${confirmed.id}/status`, { method: "PATCH", staff: token, body: { status: "CONFIRMED" } });
    expect((await spots(departure.id)).availableSpots).toBe(2);

    await call(`/api/v1/bookings/${pending.id}/status`, { method: "PATCH", staff: token, body: { status: "CANCELLED" } });
    expect((await spots(departure.id)).availableSpots).toBe(2);
  });

  it("rejects moves out of a final state", async () => {
    const { tenant, token } = await makeTenant();
    const { activity, departure } = await makeTrip(tenant.id);
    const b = (await book(tenant.slug, activity.id, departure.id, 1)).json.booking;
    await call(`/api/v1/bookings/${b.id}/status`, { method: "PATCH", staff: token, body: { status: "CANCELLED" } });
    const again = await call(`/api/v1/bookings/${b.id}/status`, { method: "PATCH", staff: token, body: { status: "CONFIRMED" } });
    expect(again.status).toBe(409);
    expect(again.json.code).toBe("INVALID_TRANSITION");
  });

  it("won't confirm more seats than are free", async () => {
    const { tenant, token } = await makeTenant();
    const { activity, departure } = await makeTrip(tenant.id, { capacity: 3 });
    const a = (await book(tenant.slug, activity.id, departure.id, 2)).json.booking;
    const b = (await book(tenant.slug, activity.id, departure.id, 2)).json.booking;
    expect((await call(`/api/v1/bookings/${a.id}/status`, { method: "PATCH", staff: token, body: { status: "CONFIRMED" } })).status).toBe(200);
    const second = await call(`/api/v1/bookings/${b.id}/status`, { method: "PATCH", staff: token, body: { status: "CONFIRMED" } });
    expect(second.status).toBe(409);
    expect(second.json.code).toBe("NOT_ENOUGH_SPOTS");
  });

  it("rejects extras that aren't offered on the trip", async () => {
    const { tenant } = await makeTenant();
    const { activity, departure } = await makeTrip(tenant.id);
    const [extra] = await db().insert(schema.extras).values({ tenantId: tenant.id, name: "Porter", price: 50 }).returning();
    const res = await book(tenant.slug, activity.id, departure.id, 1, { extraIds: [extra.id] });
    expect(res.status).toBe(400);

    await db().insert(schema.activityExtras).values({ activityId: activity.id, extraId: extra.id });
    const ok = await book(tenant.slug, activity.id, departure.id, 2, { extraIds: [extra.id, extra.id] });
    expect(ok.status).toBe(201);
    expect(ok.json.booking.totalPrice).toBe(1000 * 2 + 50 * 2);
  });

  it("refuses departures that already started", async () => {
    const { tenant } = await makeTenant();
    const { activity, departure } = await makeTrip(tenant.id, { startDate: "2020-01-01" });
    expect((await book(tenant.slug, activity.id, departure.id, 1)).status).toBe(409);
  });
});

describe("departures", () => {
  it("keeps booked seats when capacity changes and blocks going below them", async () => {
    const { tenant, token } = await makeTenant();
    const { activity, departure } = await makeTrip(tenant.id, { capacity: 4 });
    const b = (await book(tenant.slug, activity.id, departure.id, 3)).json.booking;
    await call(`/api/v1/bookings/${b.id}/status`, { method: "PATCH", staff: token, body: { status: "CONFIRMED" } });

    const grow = await call(`/api/v1/departures/${departure.id}`, { method: "PATCH", staff: token, body: { capacity: 6 } });
    expect(grow.json.departure.availableSpots).toBe(3);

    const shrink = await call(`/api/v1/departures/${departure.id}`, { method: "PATCH", staff: token, body: { capacity: 2 } });
    expect(shrink.status).toBe(409);
    expect(shrink.json.code).toBe("CAPACITY_BELOW_BOOKED");
  });

  it("can't be deleted while it has live bookings", async () => {
    const { tenant, token } = await makeTenant();
    const { activity, departure } = await makeTrip(tenant.id);
    await book(tenant.slug, activity.id, departure.id, 1);
    const res = await call(`/api/v1/departures/${departure.id}`, { method: "DELETE", staff: token });
    expect(res.status).toBe(409);
    expect(res.json.code).toBe("DEPARTURE_HAS_BOOKINGS");
  });

  it("validates dates", async () => {
    const { tenant, token } = await makeTenant();
    const { activity } = await makeTrip(tenant.id);
    const bad = await call("/api/v1/departures", {
      staff: token,
      body: { activityId: activity.id, startDate: "2026-09-10", endDate: "2026-09-01", capacity: 5, price: 10 },
    });
    expect(bad.status).toBe(400);
  });
});

describe("departure status", () => {
  it("derives OPEN/FULL from free seats even when the form sends a stale status", async () => {
    const { tenant, token } = await makeTenant();
    const { activity, departure } = await makeTrip(tenant.id, { capacity: 2 });
    const b = (await book(tenant.slug, activity.id, departure.id, 2)).json.booking;
    await call(`/api/v1/bookings/${b.id}/status`, { method: "PATCH", staff: token, body: { status: "CONFIRMED" } });
    expect((await spots(departure.id)).status).toBe("FULL");

    const grown = await call(`/api/v1/departures/${departure.id}`, {
      method: "PATCH",
      staff: token,
      body: { capacity: 5, status: "FULL" },
    });
    expect(grown.json.departure.status).toBe("OPEN");

    const delayed = await call(`/api/v1/departures/${departure.id}`, { method: "PATCH", staff: token, body: { status: "DELAYED" } });
    expect(delayed.json.departure.status).toBe("DELAYED");
    const edited = await call(`/api/v1/departures/${departure.id}`, { method: "PATCH", staff: token, body: { price: 900 } });
    expect(edited.json.departure.status).toBe("DELAYED");
  });
});
