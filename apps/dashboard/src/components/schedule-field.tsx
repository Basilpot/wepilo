import { DatePicker } from "@/components/date-picker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "@/components/icons";

/** "2027-01-12T08:00:00.000Z" → ["2027-01-12", "09:00"] in the person's own time zone. */
export function splitLocal(iso: string | null | undefined): [string, string] {
  if (!iso) return ["", ""];
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return [`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, `${pad(d.getHours())}:${pad(d.getMinutes())}`];
}

/** ["2027-01-12", "09:00"] in local time → an ISO string the API stores. */
export function joinLocal(date: string, time: string): string | null {
  if (!date) return null;
  const d = new Date(`${date}T${time || "09:00"}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** "Tue 12 Jan, 09:00" */
export function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Pick when a draft goes live: a day and a time in the person's own time zone. Clearing it
 * unschedules the draft. The publish job runs every five minutes, so it goes live within five
 * minutes of the time chosen.
 */
export function ScheduleField({ value, onChange, disabled }: { value: string | null; onChange: (iso: string | null) => void; disabled?: boolean }) {
  const [date, time] = splitLocal(value);
  const today = splitLocal(new Date().toISOString())[0];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DatePicker value={date} min={today} disabled={disabled} onChange={(d) => onChange(joinLocal(d, time || "09:00"))} placeholder="Choose a day" className="w-44" />
      <Input
        type="time"
        aria-label="Time"
        className="w-28"
        value={time}
        disabled={disabled || !date}
        onChange={(e) => onChange(joinLocal(date, e.target.value))}
      />
      {value && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} disabled={disabled}>
          <X />
          Unschedule
        </Button>
      )}
    </div>
  );
}
