import { toast } from "sonner";


export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
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
  const res = await fetch(url, {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    credentials: "include",
    headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/")) {
      window.dispatchEvent(new Event("narfu:unauthorized"));
    }
    if (res.status === 402 && (data as { code?: string }).code === "PAYMENT_REQUIRED") {
      window.dispatchEvent(new Event("narfu:payment-required"));
    }
    throw new ApiClientError(res.status, (data as { error?: string }).error ?? "Request failed", (data as { code?: string }).code);
  }
  return data as T;
}

export async function uploadFile<T = unknown>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/v1${path}`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiClientError(res.status, (data as { error?: string }).error ?? "Upload failed");
  return data as T;
}

export type Paginated<T> = {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

/** Error toast for a failed API call; plan-limit errors get a shortcut to billing. */
export function toastApiError(err: unknown, fallback = "Something went wrong. Try again.") {
  if (err instanceof ApiClientError && err.code === "PLAN_LIMIT") {
    toast.error(err.message, {
      action: { label: "See plans", onClick: () => window.location.assign("/settings/billing") },
    });
    return;
  }
  toast.error(err instanceof ApiClientError ? err.message : fallback);
}
