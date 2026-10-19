import type { Context } from "hono";
import { z } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export function fail(c: Context, status: number, message: string, code?: string) {
  return c.json({ error: message, ...(code ? { code } : {}) }, status as never);
}

export async function handleRouteError(c: Context, err: unknown) {
  if (err instanceof ApiError) {
    return fail(c, err.status, err.message, err.code);
  }
  if (err instanceof z.ZodError) {
    const issue = err.issues[0];
    return fail(c, 400, `${issue.path.join(".") || "body"}: ${issue.message}`, "VALIDATION");
  }
  console.error(err);
  return fail(c, 500, "Internal server error");
}

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function paginate<T>(rows: T[], page: number, limit: number, total: number) {
  return {
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export function getOffset(page: number, limit: number) {
  return (page - 1) * limit;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

export function jsonColumn<T>(value: unknown): T {
  return value as T;
}
