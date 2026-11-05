import { app } from "@/app";
import type { Env } from "@/env";
import { signToken, staffCookieName } from "@/lib/auth";
import type { ConnectionProps } from "./props";

/** A failed call to the Wepilo API, with the API's own message so the assistant can relay it. */
export class WepiloApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

type CallOptions = {
  method?: "GET" | "POST" | "PATCH";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

/**
 * Calls the Wepilo API in-process as the connected staff member. Each call carries a short-lived
 * staff token, so the existing role checks, paywall, validation and plan limits apply unchanged,
 * and a staff login that has since been disabled or removed stops working immediately.
 */
export async function callApi<T>(
  env: Env,
  ctx: ExecutionContext,
  props: ConnectionProps,
  path: string,
  { method = "GET", query, body }: CallOptions = {},
): Promise<T> {
  const token = await signToken(
    env,
    { kind: "staff", staffId: props.staffId, tenantId: props.tenantId, role: props.role },
    "5m",
  );
  const url = new URL(`/api/v1${path}`, env.API_BASE_URL);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  const headers = new Headers({ Cookie: `${staffCookieName}=${token}` });
  if (body !== undefined) headers.set("Content-Type", "application/json");

  const res = await app.fetch(
    new Request(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }),
    env,
    ctx,
  );
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) {
    const fallback =
      res.status === 401
        ? "This connection is no longer signed in. Reconnect Wepilo in your AI app."
        : res.status === 403
          ? "Your Wepilo role doesn't allow this. Ask the workspace owner if you need it."
          : res.status === 402
            ? "This Wepilo workspace has no active plan, so it can't be used right now."
            : `Wepilo returned an error (${res.status}).`;
    // Role refusals read better in our words than the API's terse "Insufficient permissions".
    const message = res.status === 403 || !data.error ? fallback : data.error;
    throw new WepiloApiError(res.status, message, data.code);
  }
  return data as T;
}
