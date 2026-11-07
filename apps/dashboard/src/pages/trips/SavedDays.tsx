import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Library, Save } from "@/components/icons";
import { api, toastApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ItineraryDay } from "@/pages/trips/trip-form";

type Saved = { id: number; name: string; data: Omit<ItineraryDay, "id" | "day"> };
const KEY = ["snippets", "/saved-sections"];

/** Saves one itinerary day so it can be reused in other trips. */
export function SaveDayButton({ day }: { day: ItineraryDay }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const save = useMutation({
    meta: { success: "Day saved. Insert it into any trip with “Insert a saved day”." },
    mutationFn: () => {
      const { id: _id, day: _day, ...data } = day;
      return api("/saved-sections", { body: { name: name.trim(), data } });
    },
    onSuccess: () => {
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
    onError: (err) => toastApiError(err),
  });
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setName(day.title.trim());
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Save this day for reuse" title="Save for reuse" className="text-muted-foreground">
          <Save />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2 p-3" align="end">
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) save.mutate();
          }}
        >
          <p className="text-xs font-medium text-muted-foreground">Save this day for reuse as</p>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Arrival in Paris" className="h-8" />
          <Button type="submit" size="sm" className="w-full" disabled={!name.trim() || save.isPending}>
            Save day
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** Lists saved days; picking one hands its content back to be added as a new day. */
export function InsertSavedDay({ onInsert }: { onInsert: (data: Saved["data"]) => void }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: KEY, queryFn: () => api<{ data: Saved[] }>("/saved-sections"), enabled: open });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/[0.04] hover:text-primary"
        >
          <Library className="size-4" />
          Insert a saved day
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="center">
        {isLoading ? (
          <p className="p-2 text-sm text-muted-foreground">Loading…</p>
        ) : data?.data.length ? (
          <ul className="max-h-64 overflow-y-auto">
            {data.data.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="w-full truncate rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    onInsert(s.data);
                    setOpen(false);
                  }}
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-2 text-sm text-muted-foreground">No saved days yet. Use the save icon on any day to keep it for later.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
