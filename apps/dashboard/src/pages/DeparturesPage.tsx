import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, PenLine, Plus, Trash2, CalendarCheck } from "lucide-react";
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
  const [status, setStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Departure | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const errorMessage = useErrorMessage();

  const { data, isLoading } = useQuery({
    queryKey: ["departures", page, limit, status],
    queryFn: () =>
      api<Paginated<Departure>>("/departures", {
        query: { page, limit, status: status === "all" ? undefined : status },
      }),
  });

  const { data: trips } = useQuery({
    queryKey: ["trip-options"],
    queryFn: () => api<{ data: TripOption[] }>("/activities", { query: { limit: 100 } }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["departures"] });

  const save = useMutation({
    meta: { success: "Saved" },
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
    meta: { success: "Deleted" },
    mutationFn: (id: number) => api(`/departures/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const delay = useMutation({
    meta: { success: "Departure updated" },
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
        description="Date-based inventory your guests can book."
        action={
          <Button onClick={openCreate}>
            <Plus />
            New departure
          </Button>
        }
      />

      <Tabs className="mb-3" value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
        <TabsList>
          <TabsTrigger value="all" className="px-3">All</TabsTrigger>
          <TabsTrigger value="OPEN" className="px-3">Open</TabsTrigger>
          <TabsTrigger value="FULL" className="px-3">Full</TabsTrigger>
          <TabsTrigger value="DELAYED" className="px-3">Delayed</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(d) => d.id}
        isLoading={isLoading}
        onRowClick={openEdit}
        emptyTitle="No departures yet"
        emptyHint="Create a trip first, then open a departure for it."
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
        onSubmit={() => save.mutate()}
        pending={save.isPending}
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Field label="Trip" required>
          <Select value={form.activityId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, activityId: v === "none" ? "" : v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select a trip" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select…</SelectItem>
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
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </Field>
          <Field label="End date">
            <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
          </Field>
          <Field label="Capacity" required>
            <Input
              type="number"
              min={0}
              value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
            />
          </Field>
          <Field label="Price (USD)" required>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Status">
          <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as FormState["status"] }))}>
            <SelectTrigger>
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
            Currently {editing.availableSpots} of {editing.capacity} spots available
          </div>
        )}
      </FormDialog>
    </div>
  );
}
