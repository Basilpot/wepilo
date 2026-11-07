/** Shared display formatters so money and dates read the same everywhere. */

/** The agency's currency, set once the session loads (Settings → Payments). */
let defaultCurrency = "USD";
export const setDefaultCurrency = (code: string | null | undefined) => {
  defaultCurrency = code && /^[A-Z]{3}$/.test(code) ? code : "USD";
};
export const getDefaultCurrency = () => defaultCurrency;

export const money = (n: number, currency = defaultCurrency) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

/** Whole currency units from the API's minor units (cents), with the decimals kept. */
export const moneyMinor = (minor: number, currency = defaultCurrency) => {
  const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(minor / 10 ** digits);
};

/** "2026-10-28" → "Oct 28, 2026" (date-only strings stay in local time). */
export const formatDate = (value: string | number | Date) => {
  const d = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};
