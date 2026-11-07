import { describe, expect, it } from "vitest";
import { call, makeTenant } from "./helpers";

describe("cookie sessions", () => {
  it("work from the dashboard origin", async () => {
    const { token } = await makeTenant();
    const res = await call("/api/v1/bookings", { staff: token, headers: { origin: "http://localhost:5173" } });
    expect(res.status).toBe(200);
  });

  it("are ignored when the request comes from another site", async () => {
    const { token } = await makeTenant();
    const res = await call("/api/v1/bookings", { staff: token, headers: { origin: "https://evil.example" } });
    expect(res.status).toBe(401);
  });
});

describe("rate limits", () => {
  it("throttles password guesses per email", async () => {
    const body = { email: "nobody@test.dev", password: "wrong-password" };
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) statuses.push((await call("/api/v1/auth/staff/login", { body })).status);
    expect(statuses.slice(0, 8).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(8)).toEqual([429, 429]);
  });

  it("throttles public inquiries and sends Retry-After", async () => {
    const { tenant } = await makeTenant();
    const body = { name: "A", email: "a@example.com", message: "hello" };
    let last = { status: 0, headers: new Headers() };
    for (let i = 0; i < 13; i++) last = await call("/api/v1/inquiries", { slug: tenant.slug, body });
    expect(last.status).toBe(429);
    expect(Number(last.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});
