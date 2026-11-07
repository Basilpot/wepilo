/** Small helpers for turning API content into something a page can show. */

export const money = (amount: number | null | undefined, currency: string) =>
  amount == null ? "" : new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);

export const dateLong = (value: string | number | Date | null | undefined) =>
  value ? new Date(value).toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" }) : "";

export const dateShort = (value: string | number | Date | null | undefined) =>
  value ? new Date(value).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" }) : "";

/** Plain text from HTML, for meta descriptions and card blurbs. */
export const plain = (html: string | null | undefined, max = 160) => {
  const text = (html ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
};

/**
 * Content comes from the agency's own editor, so it is trusted, but a page should still never run scripts
 * or inline handlers that slipped into it.
 */
export const safeHtml = (html: string | null | undefined) =>
  (html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");

export const images = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

export const list = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

export const stars = (n: number) => "★★★★★".slice(0, Math.round(n)) + "☆☆☆☆☆".slice(0, 5 - Math.round(n));
