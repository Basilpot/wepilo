/** Shared display formatters so money and dates read the same everywhere. */

export const money = (n: number, currency = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

/** "2026-10-28" → "Oct 28, 2026" (date-only strings stay in local time). */
export const formatDate = (value: string | number | Date) => {
  const d = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};
