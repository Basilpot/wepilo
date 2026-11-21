import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, toastApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScheduleField, formatWhen } from "@/components/schedule-field";
import { Clock } from "@/components/icons";

/**
 * "Schedule": pick when a saved draft goes live. Saves any unsaved changes first (through
 * `beforeSave`), then stores `publishAt` on the record at `path`.
 */
export function ScheduleButton({
  path,
  value,
  onChange,
  beforeSave,
  disabled,
  noun = "it",
}: {
  /** The record's API path, e.g. /blogs/12. */
  path: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  /** Save pending edits first; return false to stop. */
  beforeSave?: () => Promise<boolean>;
  disabled?: boolean;
  noun?: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(value);
  const [pending, setPending] = useState(false);

  const saveSchedule = async () => {
    setPending(true);
    try {
      if (beforeSave && !(await beforeSave())) return;
      await api(path, { method: "PATCH", body: { publishAt: draft } });
      onChange(draft);
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      toast.success(draft ? `Scheduled for ${formatWhen(draft)}` : "Schedule removed. It stays a draft.");
    } catch (err) {
      toastApiError(err, "Could not save the schedule");
    } finally {
      setPending(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(value);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" disabled={disabled || pending}>
          <Clock />
          <span className="hidden sm:inline">{value ? "Scheduled" : "Schedule"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto space-y-3">
        <div>
          <p className="text-sm font-medium">Go live later</p>
          <p className="text-xs text-muted-foreground">Saves your changes and publishes {noun} at this time, in your time zone.</p>
        </div>
        <ScheduleField value={draft} onChange={setDraft} />
        <div className="flex justify-end">
          <Button size="sm" onClick={() => void saveSchedule()} disabled={pending}>
            {draft ? "Save schedule" : "Unschedule"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
