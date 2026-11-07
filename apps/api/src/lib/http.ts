import type { Context } from "hono";
import { z } from "zod";
import { sql, type SQL, type Column } from "drizzle-orm";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export function fail(
  c: Context,
  status: number,
  message: string,
  code?: string,
  headers?: Record<string, string>,
) {
  return c.json({ error: message, ...(code ? { code } : {}) }, status as never, headers);
}

/** Turns a validation problem into a sentence a person can act on. */
function friendlyIssue(issue: z.ZodIssue): string {
  // A message a developer wrote on purpose ("Choose a star rating.") beats the generic wording below.
  const zodDefault = /^(Required|Invalid|Expected |String must|Number must|Array must|Too |Input )/.test(issue.message);
  if (issue.message && !zodDefault && issue.code !== "custom") return issue.message;
  switch (issue.code) {
    case "invalid_type":
      if (issue.received === "undefined" || issue.received === "null") return "This is required.";
      if (issue.expected === "number") return "Enter a number.";
      if (issue.expected === "boolean") return "Choose yes or no.";
      if (issue.expected === "array") return "Choose at least one option.";
      return "This doesn't look right. Check it and try again.";
    case "too_small":
      if (issue.type === "string") return issue.minimum <= 1 ? "This is required." : `Use at least ${issue.minimum} characters.`;
      if (issue.type === "array") return issue.minimum <= 1 ? "Choose at least one option." : `Choose at least ${issue.minimum}.`;
      if (issue.type === "number") return `Enter ${issue.minimum} or more.`;
      return "This is too short.";
    case "too_big":
      if (issue.type === "string") return `Use ${issue.maximum} characters or fewer.`;
      if (issue.type === "array") return `Choose ${issue.maximum} or fewer.`;
      if (issue.type === "number") return `Enter ${issue.maximum} or less.`;
      return "This is too long.";
    case "invalid_string":
      if (issue.validation === "email") return "Enter a valid email address, like name@example.com.";
      if (issue.validation === "url") return "Enter a full web address, starting with https://.";
      if (issue.validation === "regex") return issue.message && issue.message !== "Invalid" ? issue.message : "Use the format shown in the hint.";
      return "This doesn't look right. Check it and try again.";
    case "invalid_enum_value":
      return "Choose one of the options.";
    case "invalid_date":
      return "Enter a valid date.";
    case "custom":
      return issue.message || "This doesn't look right.";
    default:
      return issue.message && issue.message !== "Invalid" ? issue.message : "This doesn't look right. Check it and try again.";
  }
}

export async function handleRouteError(c: Context, err: unknown) {
  if (err instanceof ApiError) {
    return fail(c, err.status, err.message, err.code, err.headers);
  }
  if (err instanceof z.ZodError) {
    // One plain-language message per field, so a form can show each one under its own input.
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "body";
      if (!(key in fields)) fields[key] = friendlyIssue(issue);
    }
    const count = Object.keys(fields).length;
    const message = count === 1 ? Object.values(fields)[0] : "Please check the highlighted fields and try again.";
    return c.json({ error: message, code: "VALIDATION", fields }, 400 as never);
  }
  console.error(err);
  return fail(c, 500, "Something went wrong on our side. Please try again in a moment.");
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

/** Escapes % _ and \ so user text is matched literally inside a LIKE pattern (use with ESCAPE '\'). */
export function likePattern(input: string) {
  return `%${input.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

/** `column LIKE %term%` where %, _ and \ in `term` match literally. */
export function contains(column: Column, term: string): SQL {
  return sql`${column} LIKE ${likePattern(term)} ESCAPE '\\'`;
}
