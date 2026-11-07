import * as React from "react";
import { CalendarDays as CalendarIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** "2026-11-14" → a Date at local midnight. Avoids the one-day shift that new Date("2026-11-14") causes west of UTC. */
const parse = (value: string): Date | undefined => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
};
const format = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * A date field that opens a calendar. The value is a "YYYY-MM-DD" string, the same as a native date input,
 * so it can replace one without changing the form's data.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  min,
  disabled,
  id,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Earliest selectable date, as "YYYY-MM-DD". */
  min?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = parse(value);
  const earliest = min ? parse(min) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("h-8 w-full justify-between font-normal", !selected && "text-muted-foreground", className)}
        >
          <span className="truncate">
            {selected ? selected.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : placeholder}
          </span>
          <CalendarIcon className="size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? earliest}
          disabled={earliest ? { before: earliest } : undefined}
          onSelect={(d) => {
            if (d) onChange(format(d));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
