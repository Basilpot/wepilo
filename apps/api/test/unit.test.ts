import { describe, expect, it } from "vitest";
import { canTransition, seatDelta, isIsoDate, extrasTotal } from "@/lib/bookings";
import { isTrustedOrigin } from "@/lib/origin";
import { likePattern } from "@/lib/http";

describe("booking rules", () => {
  it("only allows forward moves", () => {
    expect(canTransition("PENDING", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "PENDING" as never)).toBe(false);
    expect(canTransition("CANCELLED", "CONFIRMED")).toBe(false);
    expect(canTransition("COMPLETED", "CANCELLED")).toBe(false);
  });
  it("moves seats only while confirmed", () => {
    expect(seatDelta("PENDING", "CONFIRMED", 3)).toBe(3);
    expect(seatDelta("CONFIRMED", "CANCELLED", 3)).toBe(-3);
    expect(seatDelta("PENDING", "CANCELLED", 3)).toBe(0);
    expect(seatDelta("CONFIRMED", "COMPLETED", 3)).toBe(0);
  });
  it("checks real calendar dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("10/02/2026")).toBe(false);
  });
  it("charges priced extras per traveller", () => {
    expect(extrasTotal([{ price: 50 }, { price: null }, { price: 0 }], 3)).toBe(150);
  });
});

describe("trusted origins", () => {
  const env = {
    DASHBOARD_URL: "https://app.wepilo.test",
    SITE_URL: "https://wepilo.test",
    API_BASE_URL: "https://api.wepilo.test",
    ENVIRONMENT: "production",
  };
  it("accepts own apps, rejects others and production localhost", () => {
    expect(isTrustedOrigin(env, "https://app.wepilo.test")).toBe(true);
    expect(isTrustedOrigin(env, undefined)).toBe(true);
    expect(isTrustedOrigin(env, "https://evil.test")).toBe(false);
    expect(isTrustedOrigin(env, "http://localhost:5173")).toBe(false);
    expect(isTrustedOrigin({ ...env, ENVIRONMENT: "development" }, "http://localhost:5173")).toBe(true);
  });
});

describe("likePattern", () => {
  it("escapes wildcards", () => {
    expect(likePattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});
