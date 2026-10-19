import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleCheckBig, Receipt, XCircle } from "lucide-react";
import { api, type Paginated } from "@/lib/api";
import { StatusBadge, statusOptions } from "@/components/status-badge";
import { PageHeader } from "@/components/PageHeader";
import { ContactActions } from "@/components/contact-actions";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { confirmDialog } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Booking = {
  id: number;
  name: string;
  email: string;
  phone: string;
  groupSize: number;
  totalPrice: number;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  createdAt: string | number;
  activity: { id: number; title: string | null; slug: string } | null;
  departure: { id: number; startDate: string; endDate: string | null; price: number } | null;
};

const money = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function BookingsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState<Booking | null>(null);
  const term = useDebounced(search.trim());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["bookings", page, limit, term, status],
    queryFn: () =>
      api<Paginated<Booking>>("/bookings", {
        query: { page, limit, search: term || undefined, status: status === "all" ? undefined : status },
      }),
    placeholderData: (prev) => prev,
  });

  const updateStatus = useMutation({
    meta: { success: "Booking updated" },
    mutationFn: ({ id, next }: { id: number; next: Booking["status"] }) =>
      api(`/bookings/${id}/status`, { body: { status: next }, method: "PATCH" }),
    onSuccess: (_d, { next }) => {
      setOpen((o) => (o ? { ...o, status: next } : o));
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });

  const cancel = (b: Booking) =>
    confirmDialog(
      {
        title: "Cancel booking?",
        description: `${b.name}'s ${b.groupSize} seat${b.groupSize === 1 ? "" : "s"} go back on sale. Let the guest know separately.`,
        confirmLabel: "Cancel booking",
        cancelLabel: "Keep booking",
      },
      () => updateStatus.mutate({ id: b.id, next: "CANCELLED" }),
    );

  const columns: Column<Booking>[] = [
    {
      key: "guest",
      header: "Guest",
      cell: (b) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{b.name}</p>
          <p className="truncate text-xs text-muted-foreground">{b.email}</p>
        </div>
      ),
    },
    {
      key: "trip",
      header: "Trip",
      cell: (b) => (
        <div className="min-w-0">
          <p className="truncate">{b.activity?.title ?? "—"}</p>
          {b.departure && <p className="text-xs text-muted-foreground">Departs {day(b.departure.startDate)}</p>}
        </div>
      ),
    },
    { key: "group", header: "Guests", align: "right", className: "tabular-nums", cell: (b) => b.groupSize },
    { key: "total", header: "Total", align: "right", className: "font-medium tabular-nums", cell: (b) => money(b.totalPrice) },
    { key: "status", header: "Status", cell: (b) => <StatusBadge kind="booking" status={b.status} /> },
    {
      key: "actions",
      headClassName: "w-12",
      cell: (booking) => (
        <RowActions
          actions={[
            {
              label: "Confirm booking",
              icon: CheckCircle2,
              hidden: booking.status !== "PENDING",
              onSelect: () => updateStatus.mutate({ id: booking.id, next: "CONFIRMED" }),
            },
            {
              label: "Mark completed",
              icon: CircleCheckBig,
              hidden: booking.status === "COMPLETED" || booking.status === "CANCELLED",
              onSelect: () => updateStatus.mutate({ id: booking.id, next: "COMPLETED" }),
            },
            {
              label: "Cancel booking",
              icon: XCircle,
              variant: "destructive",
              separatorBefore: true,
              hidden: booking.status === "CANCELLED" || booking.status === "COMPLETED",
              onSelect: () => cancel(booking),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Bookings" description="Seats travellers reserved on your departures." />

      <Tabs
        value={status}
        onValueChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        className="mb-3"
      >
        <TabsList>
          <TabsTrigger value="all" className="px-3">
            All
          </TabsTrigger>
          {statusOptions("booking").map((o) => (
            <TabsTrigger key={o.value} value={o.value} className="px-3">
              {o.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(b) => b.id}
        isLoading={isLoading}
        error={isError ? "We couldn't load bookings." : null}
        onRetry={() => void refetch()}
        onRowClick={setOpen}
        search={{
          value: search,
          onChange: (v) => {
            setSearch(v);
            setPage(1);
          },
        }}
        searchPlaceholder="Search by guest name or email…"
        emptyIcon={Receipt}
        emptyTitle="No bookings yet"
        emptyHint="Bookings appear here when travellers reserve a seat on one of your departures."
        emptyAction={
          <Button asChild size="sm" variant="outline">
            <Link to="/departures">Manage departures</Link>
          </Button>
        }
        pagination={
          data
            ? {
                page: data.pagination.page,
                totalPages: data.pagination.totalPages,
                total: data.pagination.total,
                limit,
                onPage: setPage,
                onLimit: (l) => {
                  setLimit(l);
                  setPage(1);
                },
              }
            : undefined
        }
      />

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-lg">
          {open && (
            <>
              <SheetHeader className="border-b px-6 py-5 pr-14">
                <div className="flex items-center gap-2">
                  <SheetTitle className="text-base">Booking #{open.id}</SheetTitle>
                  <StatusBadge kind="booking" status={open.status} />
                </div>
                <SheetDescription>Made {day(String(open.createdAt))}</SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
                <section className="space-y-3">
                  <h3 className="text-sm font-medium">Guest</h3>
                  <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Name</dt>
                    <dd>{open.name}</dd>
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="truncate">{open.email}</dd>
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd>{open.phone || "—"}</dd>
                  </dl>
                  <ContactActions name={open.name} email={open.email} phone={open.phone} subject={open.activity?.title ?? undefined} />
                </section>
                <section className="space-y-3 border-t pt-6">
                  <h3 className="text-sm font-medium">Trip</h3>
                  <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Trip</dt>
                    <dd>
                      {open.activity ? (
                        <Link to={`/trips/${open.activity.id}`} className="hover:underline">
                          {open.activity.title}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </dd>
                    <dt className="text-muted-foreground">Departure</dt>
                    <dd>
                      {open.departure
                        ? `${day(open.departure.startDate)}${open.departure.endDate ? ` – ${day(open.departure.endDate)}` : ""}`
                        : "—"}
                    </dd>
                    <dt className="text-muted-foreground">Guests</dt>
                    <dd className="tabular-nums">{open.groupSize}</dd>
                  </dl>
                </section>
                <section className="flex items-baseline justify-between border-t pt-6">
                  <span className="text-sm font-medium">Total</span>
                  <span className="text-xl font-semibold tracking-tight tabular-nums">{money(open.totalPrice)}</span>
                </section>
              </div>
              {(open.status === "PENDING" || open.status === "CONFIRMED") && (
                <div className="flex justify-between gap-2 border-t bg-muted/30 px-6 py-3">
                  <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => cancel(open)} disabled={updateStatus.isPending}>
                    Cancel booking
                  </Button>
                  {open.status === "PENDING" ? (
                    <Button onClick={() => updateStatus.mutate({ id: open.id, next: "CONFIRMED" })} disabled={updateStatus.isPending}>
                      <CheckCircle2 />
                      Confirm booking
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => updateStatus.mutate({ id: open.id, next: "COMPLETED" })} disabled={updateStatus.isPending}>
                      Mark completed
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
