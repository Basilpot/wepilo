import { MoneyInput } from "@/components/money-input";
import { useState } from "react";
import { useTableSearch } from "@/hooks/use-table-search";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, PenLine, Plus, Trash2, CalendarCheck } from "@/components/icons";
import { money, formatDate } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, type Paginated } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/PageHeader";
import { Field, FormDialog } from "@/components/form";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { confirmDialog } from "@/components/confirm";
import { useErrorMessage } from "@/pages/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Departure = {
  id: number;
  startDate: string;
  endDate: string | null;
  capacity: number;
  availableSpots: number;
  price: number;
  status: "OPEN" | "FULL" | "DELAYED";
  activity: { id: number; title: string | null; slug: string };
};

type TripOption = { id: number; title: string | null; price: number | null };

type FormState = {
  activityId: string;
  startDate: string;
  endDate: string;
  capacity: string;
  price: string;
  status: "OPEN" | "FULL" | "DELAYED";
};

const emptyForm: FormState = {
  activityId: "",
  startDate: "",
  endDate: "",
  capacity: "",
  price: "",
  status: "OPEN",
};

export function DeparturesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const tableSearch = useTableSearch(() => setPage(1));
  const [status, setStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Departure | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const errorMessage = useErrorMessage();

  const { data, isLoading } = useQuery({
    queryKey: ["departures", page, limit, status, tableSearch.term],
    queryFn: () =>
      api<Paginated<Departure>>("/departures", {
        query: { page, limit, status: status === "all" ? undefined : status, search: tableSearch.term },
      }),
  });

  const { data: trips } = useQuery({
    queryKey: ["trip-options"],
    queryFn: () => api<{ data: TripOption[] }>("/activities", { query: { limit: 100 } }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["departures"] });

  const save = useMutation({
    meta: { success: "Departure saved. Travellers can now see these dates on your website." },
    mutationFn: () => {
      const body = {
        activityId: Number(form.activityId),
        startDate: form.startDate,
        endDate: form.endDate || null,
        capacity: Number(form.capacity),
        price: Number(form.price),
        status: form.status,
      };
      return editing
        ? api(`/departures/${editing.id}`, { body: { ...body, activityId: undefined }, method: "PATCH" })
        : api("/departures", { body, method: "POST" });
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const remove = useMutation({
    meta: { success: "Departure deleted. It no longer appears on your website." },
    mutationFn: (id: number) => api(`/departures/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const delay = useMutation({
    meta: { success: "Departure marked as delayed." },
    mutationFn: (id: number) => api(`/departures/${id}/delay`, { method: "PATCH" }),
    onSuccess: invalidate,
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (departure: Departure) => {
    setEditing(departure);
    setForm({
      activityId: String(departure.activity.id),
      startDate: departure.startDate,
      endDate: departure.endDate ?? "",
      capacity: String(departure.capacity),
      price: String(departure.price),
      status: departure.status,
    });
    setError(null);
    setDialogOpen(true);
  };

  const columns: Column<Departure>[] = [
    {
      key: "trip",
      header: "Trip",
      cell: (d) => (
        <Link
          to={`/trips/${d.activity.id}`}
          className="font-medium hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {d.activity.title ?? "Untitled"}
        </Link>
      ),
    },
    {
      key: "dates",
      header: "Dates",
      className: "whitespace-nowrap",
      cell: (d) => (
        <span>
          {formatDate(d.startDate)}
          {d.endDate && <span className="text-muted-foreground"> – {formatDate(d.endDate)}</span>}
        </span>
      ),
    },
    {
      key: "seats",
      header: "Seats booked",
      cell: (d) => {
        const booked = d.capacity - d.availableSpots;
        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${d.capacity ? (booked / d.capacity) * 100 : 0}%` }} />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {booked}/{d.capacity}
            </span>
          </div>
        );
      },
    },
    { key: "price", header: "Price", align: "right", className: "tabular-nums", cell: (d) => money(d.price) },
    {
      key: "status",
      header: "Status",
      cell: (d) => (
        <StatusBadge kind="departure" status={d.status} />
      ),
    },
    {
      key: "actions",
      headClassName: "w-12",
      className: "text-right",
      cell: (departure) => (
        <RowActions
          actions={[
            { label: "Edit departure", icon: PenLine, onSelect: () => openEdit(departure) },
            {
              label: "Mark delayed",
              icon: Clock,
              hidden: departure.status === "DELAYED",
              onSelect: () => delay.mutate(departure.id),
            },
            {
              label: "Delete",
              icon: Trash2,
              variant: "destructive",
              separatorBefore: true,
              onSelect: () => confirmDialog({ description: "Delete this departure?" }, () => remove.mutate(departure.id)),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Departures"
        description="A departure is one specific start date for a trip, with a set number of seats and a price. Travellers can only book your trips online if the trip has an upcoming departure with seats left. Add, edit or delay departures here."
        action={
          <Button onClick={openCreate}>
            <Plus />
            New departure
          </Button>
        }
      />

      <DataTable
        toolbar={
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="FULL">Full</SelectItem>
              <SelectItem value="DELAYED">Delayed</SelectItem>
            </SelectContent>
          </Select>
        }
        search={tableSearch.search}
        searchPlaceholder="Search by trip…"
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(d) => d.id}
        isLoading={isLoading}
        onRowClick={openEdit}
        emptyTitle="No departures yet"
        emptyHint="Travellers can only book a trip once it has a departure date. If you have not created a trip yet, start with “Trips” in the menu. Then come back here and select “New departure”."
        emptyIcon={CalendarCheck}
        pagination={
          data
            ? {
                page: data.pagination.page,
                totalPages: data.pagination.totalPages,
                total: data.pagination.total,
                limit,
                onPage: setPage,
                onLimit: (l) => { setLimit(l); setPage(1); },
              }
            : undefined
        }
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit departure" : "New departure"}
        description={editing ? "Change the dates, number of seats, price or availability. Changes show on your website straight away." : "Choose the trip, the dates it runs, how many seats you can sell and the price for one traveller."}
        onSubmit={() => save.mutate()}
        pending={save.isPending}
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Field label="Trip" required>
          <Select value={form.activityId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, activityId: v === "none" ? "" : v }))}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Click to choose a trip" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Choose a trip</SelectItem>
              {trips?.data.map((trip) => (
                <SelectItem key={trip.id} value={String(trip.id)}>
                  {trip.title ?? "Untitled"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date" required>
            <DatePicker value={form.startDate} onChange={(v) => setForm((f) => ({ ...f, startDate: v }))} placeholder="Choose the start date" />
          </Field>
          <Field label="End date">
            <DatePicker value={form.endDate} min={form.startDate || undefined} onChange={(v) => setForm((f) => ({ ...f, endDate: v }))} placeholder="Choose the end date" />
          </Field>
          <Field label="Capacity" required>
            <Input
              type="number"
              min={0}
              value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
            />
          </Field>
          <Field label="Price per person" required>
            <MoneyInput value={form.price} onChange={(v) => setForm((f) => ({ ...f, price: v }))} placeholder="0.00" />
          </Field>
        </div>
        <Field label="Status">
          <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as FormState["status"] }))}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="FULL">Full</SelectItem>
              <SelectItem value="DELAYED">Delayed</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {editing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked disabled />
            Right now {editing.availableSpots} of {editing.capacity} seats are still available to book
          </div>
        )}
      </FormDialog>
    </div>
  );
}
