import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Number field for a USD amount, with the currency shown inside the field. */
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
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-muted-foreground">$</span>
      <Input
        id={id}
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-7 tabular-nums"
      />
    </div>
  );
}
