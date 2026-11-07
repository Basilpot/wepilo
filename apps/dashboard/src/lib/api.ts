import { toast } from "sonner";
import { clearFieldErrors, setFieldErrors } from "@/lib/field-errors";


/** Replaces technical or generic server wording with something a person can act on. */
function friendly(status: number, message: string | undefined): string {
  if (status >= 500) return "Something went wrong on our side. Please try again in a moment.";
  switch (message) {
    case undefined:
    case "":
    case "Request failed":
      return "Something went wrong and your change was not saved. Please try again.";
    case "Insufficient permissions":
      return "You don't have permission to do that. Ask the owner of this workspace.";
    case "Authentication required":
      return "Please sign in again to continue.";
    case "Tenant context required":
      return "We couldn't tell which workspace this belongs to. Refresh the page and try again.";
  }
  return message;
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    /** For validation errors: a plain-language message per field. */
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  raw?: boolean;
};

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`/api/v1${path}`, window.location.origin);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
  }
  const method = options.method ?? (options.body !== undefined ? "POST" : "GET");
  // A new save starts with a clean slate. Background reads must not wipe the messages a person is looking at.
  if (method !== "GET") clearFieldErrors();
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: "include",
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiClientError(0, "We couldn't reach the server. Check your internet connection and try again.", "NETWORK");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/") && !path.startsWith("/platform/")) {
      window.dispatchEvent(new Event("wepilo:unauthorized"));
    }
    if (res.status === 402 && (data as { code?: string }).code === "PAYMENT_REQUIRED") {
      window.dispatchEvent(new Event("wepilo:payment-required"));
    }
    const body = data as { error?: string; code?: string; fields?: Record<string, string> };
    if (body.code === "VALIDATION" && body.fields) setFieldErrors(body.fields);
    throw new ApiClientError(res.status, friendly(res.status, body.error), body.code, body.fields);
  }
  return data as T;
}

export async function uploadFile<T = unknown>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
  } catch {
    throw new ApiClientError(0, "We couldn't upload that file. Check your internet connection and try again.", "NETWORK");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiClientError(res.status, friendly(res.status, (data as { error?: string }).error ?? "Upload failed"));
  return data as T;
}

export type Paginated<T> = {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

/** Error toast for a failed API call; plan-limit errors get a shortcut to billing. */
export function toastApiError(err: unknown, fallback = "Something went wrong and your change was not saved. Please try again in a moment.") {
  if (err instanceof ApiClientError && err.code === "PLAN_LIMIT") {
    toast.error(err.message, {
      action: { label: "See plans", onClick: () => window.location.assign("/settings/billing") },
    });
    return;
  }
  if (err instanceof ApiClientError && err.code === "VALIDATION" && err.fields) {
    // Nothing to highlight here, so say which field and what is wrong: "Title: This is required."
    const label = (key: string) => {
      const words = key.split(".").pop()!.replace(/([A-Z])/g, " $1").toLowerCase().trim();
      return words.charAt(0).toUpperCase() + words.slice(1);
    };
    const lines = Object.entries(err.fields).slice(0, 3).map(([key, msg]) => `${label(key)}: ${msg}`);
    toast.error("Please check these fields and try again.", { description: lines.join("\n") });
    return;
  }
  toast.error(err instanceof ApiClientError ? err.message : fallback);
}
