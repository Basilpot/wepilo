import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getDefaultCurrency } from "@/lib/format";

/** "EUR" → "€", "NPR" → "NPR" or "Rs", depending on the browser's locale. */
function currencySymbol(code: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code, currencyDisplay: "narrowSymbol" }).formatToParts(0).find((p) => p.type === "currency")?.value ?? code;
  } catch {
    return code;
  }
}

/** Number field for an amount in the agency's currency (Settings → Payments), with the symbol shown inside the field. */
export function MoneyInput({
  value,
  onChange,
  placeholder,
  id,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  const symbol = currencySymbol(getDefaultCurrency());
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-muted-foreground">{symbol}</span>
      <Input
        id={id}
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="tabular-nums"
        // Room for the symbol, whether it is "$" or "NPR".
        style={{ paddingLeft: `${14 + symbol.length * 8 + 6}px` }}
      />
    </div>
  );
}
