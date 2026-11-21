import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/App";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, FormDialog } from "@/components/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScheduleField, formatWhen, joinLocal } from "@/components/schedule-field";
import { CalendarCheck, ChevronLeft, ChevronRight, Footprints, Newspaper, NotebookPen, Plus } from "@/components/icons";
import { useErrorMessage } from "@/pages/shared";
import { cn } from "@/lib/utils";

type Kind = "trip" | "post" | "page" | "departure";
type CalendarItem = {
  kind: Kind;
  id: number;
  title: string | null;
  at: string;
  state: "scheduled" | "published" | "open" | "full" | "delayed";
  tripId?: number;
  seatsLeft?: number;
  capacity?: number;
};
type Draft = { kind: Exclude<Kind, "departure">; id: number; title: string | null };

/** Where each kind of content is saved and edited. */
const CONTENT = {
  trip: { label: "Trip", api: "/activities", editor: "/trips", icon: Footprints },
  post: { label: "Post", api: "/blogs", editor: "/posts", icon: Newspaper },
  page: { label: "Page", api: "/info-pages", editor: "/info-pages", icon: NotebookPen },
} as const;

/** One colour per kind, so a month reads at a glance. Departures are outlined: they're dates, not content. */
const KIND_STYLE: Record<Kind, string> = {
  trip: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
  post: "bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-200",
  page: "bg-violet-100 text-violet-900 dark:bg-violet-500/15 dark:text-violet-200",
  departure: "border border-dashed border-border bg-background text-foreground",
};
const PUBLISHERS = ["OWNER", "ADMIN", "MANAGER", "EDITOR"];
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: "short" }));

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localDay = (iso: string) => ymd(new Date(iso));
/** Departures carry a date, not a time: read it as that calendar day, wherever the person is. */
const itemDay = (i: CalendarItem) => (i.kind === "departure" ? i.at.slice(0, 10) : localDay(i.at));

/** The 6 × 7 grid for a month, starting on Monday. */
function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function CalendarPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const { data: session } = useSession();
  const canPublish = PUBLISHERS.includes(session?.staff.role ?? "");

  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [shown, setShown] = useState<Record<Kind, boolean>>({ trip: true, post: true, page: true, departure: true });
  const [dialog, setDialog] = useState<{ item?: CalendarItem; day?: string } | null>(null);
  const [pick, setPick] = useState<string>("");
  const [when, setWhen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<CalendarItem | null>(null);

  const days = useMemo(() => monthGrid(month), [month]);
  const from = ymd(days[0]);
  const to = ymd(days[days.length - 1]);
  const todayKey = ymd(new Date());

  const cal = useQuery({
    queryKey: ["calendar", from, to],
    queryFn: () => api<{ items: CalendarItem[] }>("/calendar", { query: { from, to } }),
  });

  // Drafts that could be scheduled: trips, posts and pages not live and not yet scheduled.
  const drafts = useQuery({
    queryKey: ["calendar", "drafts"],
    enabled: canPublish,
    queryFn: async () => {
      const [trips, posts, pages] = await Promise.all([
        api<{ data: Array<{ id: number; title: string | null; publishAt: string | null }> }>("/activities", { query: { status: "DRAFT", limit: 100 } }),
        api<{ data: Array<{ id: number; title: string | null; publishAt: string | null }> }>("/blogs", { query: { published: "false", limit: 100 } }),
        api<{ data: Array<{ id: number; title: string | null; published: boolean; publishAt: string | null }> }>("/info-pages").catch(() => ({ data: [] })),
      ]);
      const out: Draft[] = [
        ...trips.data.filter((t) => !t.publishAt).map((t) => ({ kind: "trip" as const, id: t.id, title: t.title })),
        ...posts.data.filter((p) => !p.publishAt).map((p) => ({ kind: "post" as const, id: p.id, title: p.title })),
        ...pages.data.filter((p) => !p.published && !p.publishAt).map((p) => ({ kind: "page" as const, id: p.id, title: p.title })),
      ];
      return out;
    },
  });

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of cal.data?.items ?? []) {
      if (!shown[item.kind]) continue;
      const key = itemDay(item);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [cal.data, shown]);

  const schedule = useMutation({
    meta: { success: "Schedule saved." },
    mutationFn: ({ kind, id, publishAt }: { kind: Draft["kind"]; id: number; publishAt: string | null }) =>
      api(`${CONTENT[kind].api}/${id}`, { method: "PATCH", body: { publishAt } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      setDialog(null);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const openDay = (day: string) => {
    if (!canPublish) return;
    setDialog({ day });
    setPick("");
    setWhen(joinLocal(day, "09:00"));
    setError(null);
  };
  const openItem = (item: CalendarItem) => {
    if (item.kind === "departure") return navigate("/departures");
    if (item.state === "published" || !canPublish) return navigate(`${CONTENT[item.kind].editor}/${item.id}`);
    setDialog({ item });
    setWhen(item.at);
    setError(null);
  };

  /** Dropping a scheduled item on another day keeps its time of day. */
  const drop = (day: string) => {
    const item = dragging;
    setDragging(null);
    if (!item || item.kind === "departure" || item.state !== "scheduled" || itemDay(item) === day) return;
    const time = new Date(item.at).toTimeString().slice(0, 5);
    const publishAt = joinLocal(day, time);
    if (publishAt) schedule.mutate({ kind: item.kind, id: item.id, publishAt });
  };

  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const agenda = [...byDay.entries()].filter(([d]) => d.slice(0, 7) === ymd(month).slice(0, 7)).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Calendar"
        description="What goes live and when, and which departures are coming up. Click a day to schedule a draft, or drag a scheduled item to another day. Scheduled items go live within five minutes of their time."
        action={
          canPublish ? (
            <Button onClick={() => openDay(todayKey)}>
              <Plus />
              Schedule a draft
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRight />
          </Button>
          <h2 className="ml-2 text-lg font-semibold tracking-tight" aria-live="polite">
            {monthLabel}
          </h2>
          <Button variant="ghost" size="sm" className="ml-1" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
            Today
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show on the calendar">
          {(["trip", "post", "page", "departure"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={shown[k]}
              onClick={() => setShown((s) => ({ ...s, [k]: !s[k] }))}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-opacity",
                KIND_STYLE[k],
                !shown[k] && "opacity-40",
              )}
            >
              {k === "departure" ? "Departures" : `${CONTENT[k].label}s`}
            </button>
          ))}
        </div>
      </div>

      {/* Month grid on wider screens. */}
      <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
        <div className="grid grid-cols-7 border-b bg-muted/40 font-mono text-xs lowercase text-muted-foreground">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-3 py-2">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const key = ymd(d);
            const items = byDay.get(key) ?? [];
            const inMonth = d.getMonth() === month.getMonth();
            const past = key < todayKey;
            return (
              <div
                key={key}
                onDragOver={(e) => dragging && !past && e.preventDefault()}
                onDrop={() => drop(key)}
                className={cn(
                  "group relative min-h-28 border-b border-r p-1.5 text-left",
                  i % 7 === 6 && "border-r-0",
                  i >= 35 && "border-b-0",
                  !inMonth && "bg-muted/30 text-muted-foreground",
                  dragging && !past && "hover:bg-primary/5",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                      key === todayKey && "bg-primary font-semibold text-primary-foreground",
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {canPublish && !past && (
                    <button
                      type="button"
                      onClick={() => openDay(key)}
                      className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted focus-visible:opacity-100"
                      aria-label={`Schedule a draft on ${d.toLocaleDateString(undefined, { day: "numeric", month: "long" })}`}
                    >
                      <Plus className="size-3.5" />
                    </button>
                  )}
                </div>
                <ul className="mt-1 space-y-1">
                  {items.slice(0, 4).map((item) => (
                    <li key={`${item.kind}-${item.id}-${item.at}`}>
                      <button
                        type="button"
                        draggable={item.state === "scheduled" && canPublish}
                        onDragStart={() => setDragging(item)}
                        onDragEnd={() => setDragging(null)}
                        onClick={() => openItem(item)}
                        className={cn(
                          "flex w-full items-center gap-1 truncate rounded-md px-1.5 py-1 text-left text-xs",
                          KIND_STYLE[item.kind],
                          item.state === "published" && "opacity-70",
                          item.state === "scheduled" && canPublish && "cursor-grab active:cursor-grabbing",
                        )}
                        title={item.title ?? undefined}
                      >
                        {item.kind !== "departure" && (
                          <span className="shrink-0 tabular-nums opacity-70">{new Date(item.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                        )}
                        <span className="truncate">{item.title ?? "Untitled"}</span>
                        {item.state === "scheduled" && <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase opacity-70">soon</span>}
                        {item.kind === "departure" && item.state === "full" && <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase">full</span>}
                      </button>
                    </li>
                  ))}
                  {items.length > 4 && <li className="px-1.5 text-[11px] text-muted-foreground">+{items.length - 4} more</li>}
                </ul>
              </div>
            );
          })}
        </div>
        {cal.isLoading && (
          <div className="border-t p-3">
            <Skeleton className="h-4 w-48" />
          </div>
        )}
      </div>

      {/* Agenda on phones. */}
      <div className="space-y-3 md:hidden">
        {cal.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : agenda.length ? (
          agenda.map(([day, items]) => (
            <section key={day} className="rounded-2xl border bg-card">
              <h3 className="border-b px-4 py-2 text-sm font-medium">
                {new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
              </h3>
              <ul className="divide-y">
                {items.map((item) => (
                  <li key={`${item.kind}-${item.id}-${item.at}`}>
                    <button type="button" onClick={() => openItem(item)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                      <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium", KIND_STYLE[item.kind])}>
                        {item.kind === "departure" ? "Departure" : CONTENT[item.kind].label}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{item.title ?? "Untitled"}</span>
                      <span className="text-xs text-muted-foreground">{item.state}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        ) : (
          <p className="rounded-2xl border p-8 text-center text-sm text-muted-foreground">Nothing scheduled, published or departing this month.</p>
        )}
      </div>

      {/* Drafts waiting for a date. */}
      {canPublish && (drafts.data?.length ?? 0) > 0 && (
        <section className="rounded-2xl border bg-card">
          <header className="flex h-12 items-center justify-between border-b px-5">
            <h2 className="text-sm font-semibold">Drafts without a date</h2>
            <span className="text-xs text-muted-foreground">{drafts.data!.length}</span>
          </header>
          <ul className="flex flex-wrap gap-2 p-4">
            {drafts.data!.slice(0, 24).map((d) => {
              const Icon = CONTENT[d.kind].icon;
              return (
                <li key={`${d.kind}-${d.id}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setDialog({ day: todayKey });
                      setPick(`${d.kind}:${d.id}`);
                      setWhen(joinLocal(ymd(new Date(Date.now() + 86_400_000)), "09:00"));
                      setError(null);
                    }}
                    className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium", KIND_STYLE[d.kind])}
                  >
                    <Icon className="size-3.5" />
                    {d.title ?? "Untitled"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Schedule a draft, or change one that's already scheduled. */}
      <FormDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog?.item ? `Scheduled ${CONTENT[dialog.item.kind as Draft["kind"]]?.label.toLowerCase() ?? "item"}` : "Schedule a draft"}
        description={
          dialog?.item
            ? `${dialog.item.title ?? "Untitled"} goes live ${formatWhen(dialog.item.at)}. Change the time, or unschedule it to keep it as a draft.`
            : "Choose a draft trip, post or page and when it should go live. It stays hidden until then."
        }
        submitLabel={when ? "Save schedule" : dialog?.item ? "Unschedule" : "Save schedule"}
        pending={schedule.isPending}
        onSubmit={() => {
          setError(null);
          if (dialog?.item) {
            const kind = dialog.item.kind as Draft["kind"];
            return schedule.mutate({ kind, id: dialog.item.id, publishAt: when });
          }
          const [kind, id] = pick.split(":");
          if (!kind || !id) return setError("Choose a draft to schedule.");
          if (!when) return setError("Choose when it should go live.");
          schedule.mutate({ kind: kind as Draft["kind"], id: Number(id), publishAt: when });
        }}
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!dialog?.item && (
          <Field label="Draft" required>
            <Select value={pick || "none"} onValueChange={(v) => setPick(v === "none" ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a draft" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Choose a draft</SelectItem>
                {(drafts.data ?? []).map((d) => (
                  <SelectItem key={`${d.kind}:${d.id}`} value={`${d.kind}:${d.id}`}>
                    {CONTENT[d.kind].label} · {d.title ?? "Untitled"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field label="Goes live" hint="Your own time zone. It goes live within five minutes of this time.">
          <ScheduleField value={when} onChange={setWhen} />
        </Field>
        {dialog?.item && (
          <Button type="button" variant="link" className="h-auto p-0" asChild>
            <Link to={`${CONTENT[dialog.item.kind as Draft["kind"]].editor}/${dialog.item.id}`}>
              <CalendarCheck />
              Open the {CONTENT[dialog.item.kind as Draft["kind"]].label.toLowerCase()}
            </Link>
          </Button>
        )}
      </FormDialog>
    </div>
  );
}
