import type { Env } from "@/env";
import { ApiError } from "@/lib/http";

/** Free daily exchange rates, no key needed. https://www.exchangerate-api.com/docs/free */
const SOURCE = "https://open.er-api.com/v6/latest";
/** Rates change once a day, so a half-day cache is plenty and keeps us well inside the free limits. */
const FRESH_MS = 12 * 60 * 60 * 1000;
/** If the provider is down, the last good rates are still better than nothing for this long. */
const KEEP_SECONDS = 14 * 24 * 60 * 60;

export type Rates = {
  base: string;
  /** One unit of `base` in each currency. */
  rates: Record<string, number>;
  /** When the provider last updated them. */
  updatedAt: string;
};

type Stored = Rates & { fetchedAt: number };

export async function getRates(env: Env, base: string): Promise<Rates> {
  const key = `fx:${base}`;
  const cached = (await env.OAUTH_KV.get(key, "json")) as Stored | null;
  if (cached && Date.now() - cached.fetchedAt < FRESH_MS) return strip(cached);

  try {
    const res = await fetch(`${SOURCE}/${encodeURIComponent(base)}`, { headers: { accept: "application/json" } });
    const data = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_unix?: number };
    if (!res.ok || data.result !== "success" || !data.rates) throw new Error(`rates unavailable (${res.status})`);
    const fresh: Stored = {
      base,
      rates: data.rates,
      updatedAt: new Date((data.time_last_update_unix ?? Date.now() / 1000) * 1000).toISOString(),
      fetchedAt: Date.now(),
    };
    await env.OAUTH_KV.put(key, JSON.stringify(fresh), { expirationTtl: KEEP_SECONDS });
    return strip(fresh);
  } catch (err) {
    console.error("exchange rates", err);
    if (cached) return strip(cached);
    throw new ApiError(503, "Exchange rates are not available right now. Please try again in a few minutes.", "RATES_UNAVAILABLE");
  }
}

const strip = ({ fetchedAt: _f, ...rates }: Stored): Rates => rates;
