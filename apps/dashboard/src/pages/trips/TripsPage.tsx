import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Copy, EyeOff, FileText, Footprints, Mountain, PenLine, Plus, Star, StarOff, Trash2, Upload } from "lucide-react";
import { api, type Paginated } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { confirmDialog } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Trip = {
  id: number;
  title: string | null;
  slug: string;
  layout?: "ITINERARY" | "PAGE";
  price: number | null;
  duration: string | null;
  difficultyLevel: string | null;
  status: "DRAFT" | "PUBLISHED";
  views: number;
  averageRating: number;
  isFeatured: boolean;
  tripCategory: { id: number; name: string | null } | null;
  city: { id: number; name: string | null } | null;
  images?: string[] | null;
  tripSeo?: { featuredMedia: string | null } | null;
  updatedAt?: string;
};

// Fields that belong to the copy's identity or stats, not its content.
const NOT_COPIED = new Set([
  "id",
  "tenantId",
  "slug",
  "status",
  "views",
  "bookingsCount",
  "popularityScore",
  "averageRating",
  "createdAt",
  "updatedAt",
  "canonicalUrl",
  "urlHistory",
  "isFeatured",
]);

const money = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function TripsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [layout, setLayout] = useState<string>("all");
  const term = useDebounced(search.trim());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["trips", page, limit, term, status, layout],
    queryFn: () =>
      api<Paginated<Trip>>("/activities", {
        query: {
          page,
          limit,
          search: term || undefined,
          status: status === "all" ? undefined : status,
          layout: layout === "all" ? undefined : layout,
        },
      }),
    placeholderData: (prev) => prev,
  });

  const counts = useQuery({
    queryKey: ["trips", "counts"],
    queryFn: async () => {
      const [all, live, draft] = await Promise.all(
        [undefined, "PUBLISHED", "DRAFT"].map((s) =>
          api<Paginated<Trip>>("/activities", { query: { limit: 1, status: s } }),
        ),
      );
      return { all: all.pagination.total, PUBLISHED: live.pagination.total, DRAFT: draft.pagination.total };
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["trips"] });

  const remove = useMutation({
    meta: { success: "Trip deleted" },
    mutationFn: (id: number) => api(`/activities/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const patch = useMutation({
    meta: { success: "Trip updated" },
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      api(`/activities/${id}`, { method: "PATCH", body }),
    onSuccess: invalidate,
  });

  const duplicate = useMutation({
    meta: { success: "Copy created as a draft" },
    mutationFn: async (trip: Trip) => {
      const { activity } = await api<{ activity: Record<string, unknown> }>(`/activities/${trip.id}`);
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(activity)) {
        if (NOT_COPIED.has(key) || value === null || (typeof value === "object" && !Array.isArray(value) && key !== "meta"))
          continue;
        body[key] = value;
      }
      body.title = `${trip.title ?? "Untitled"} (copy)`;
      return api<{ activity: { id: number } }>("/activities", { body });
    },
    onSuccess: (res) => {
      void invalidate();
      navigate(`/trips/${res.activity.id}`);
    },
  });

  const columns: Column<Trip>[] = [
    {
      key: "title",
      header: "Trip",
      cell: (trip) => {
        const cover = trip.tripSeo?.featuredMedia || trip.images?.[0];
        return (
          <div className="flex items-center gap-3">
            {cover ? (
              <img src={cover} alt="" className="h-10 w-14 shrink-0 rounded-md border bg-muted object-cover" />
            ) : (
              <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground/70">
                <Mountain className="size-4" />
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Link
                  to={`/trips/${trip.id}`}
                  className="truncate font-medium hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {trip.title || "Untitled trip"}
                </Link>
                {trip.isFeatured && (
                  <Star aria-label="Featured" className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />
                )}
              </div>
              <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
                {trip.layout === "PAGE" ? <FileText className="size-3 shrink-0" /> : <CalendarDays className="size-3 shrink-0" />}
                <span className="truncate">
                  {[trip.layout === "PAGE" ? "Simple page" : "Itinerary", trip.city?.name, trip.duration].filter(Boolean).join(" · ")}
                </span>
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "category",
      header: "Category",
      className: "text-muted-foreground",
      cell: (t) => t.tripCategory?.name ?? "—",
    },
    {
      key: "price",
      header: "From",
      align: "right",
      className: "tabular-nums",
      cell: (t) => (t.price != null ? money(t.price) : <span className="text-muted-foreground">—</span>),
    },
    { key: "status", header: "Status", cell: (t) => <StatusBadge kind="trip" status={t.status} /> },
    {
      key: "views",
      header: "Views",
      align: "right",
      className: "text-muted-foreground tabular-nums",
      cell: (t) => t.views.toLocaleString(),
    },
    {
      key: "actions",
      headClassName: "w-12",
      cell: (trip) => (
        <RowActions
          actions={[
            { label: "Edit trip", icon: PenLine, onSelect: () => navigate(`/trips/${trip.id}`) },
            { label: "Duplicate", icon: Copy, onSelect: () => duplicate.mutate(trip), disabled: duplicate.isPending },
            trip.status === "PUBLISHED"
              ? { label: "Unpublish", icon: EyeOff, onSelect: () => patch.mutate({ id: trip.id, body: { status: "DRAFT" } }) }
              : { label: "Publish", icon: Upload, onSelect: () => patch.mutate({ id: trip.id, body: { status: "PUBLISHED" } }) },
            trip.isFeatured
              ? { label: "Remove from featured", icon: StarOff, onSelect: () => patch.mutate({ id: trip.id, body: { isFeatured: false } }) }
              : { label: "Feature on homepage", icon: Star, onSelect: () => patch.mutate({ id: trip.id, body: { isFeatured: true } }) },
            {
              label: "Delete",
              icon: Trash2,
              variant: "destructive",
              separatorBefore: true,
              onSelect: () =>
                confirmDialog(
                  {
                    title: "Delete trip?",
                    description: `“${trip.title ?? "This trip"}” and its departures will be removed from your site. This can't be undone.`,
                  },
                  () => remove.mutate(trip.id),
                ),
            },
          ]}
        />
      ),
    },
  ];

  const tab = (value: string, label: string) => (
    <TabsTrigger value={value} className="gap-1.5 px-3">
      {label}
      {counts.data && (
        <span className="rounded bg-muted-foreground/10 px-1.5 text-xs text-muted-foreground tabular-nums">
          {counts.data[value as keyof typeof counts.data]}
        </span>
      )}
    </TabsTrigger>
  );

  return (
    <div>
      <PageHeader
        title="Trips"
        description="Create, publish and manage your trip catalog."
        action={
          <Button asChild>
            <Link to="/trips/new">
              <Plus />
              New trip
            </Link>
          </Button>
        }
      />

      <Tabs
        value={status}
        onValueChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        className="mb-3"
      >
        <TabsList>
          {tab("all", "All")}
          {tab("PUBLISHED", "Live")}
          {tab("DRAFT", "Drafts")}
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(t) => t.id}
        isLoading={isLoading}
        error={isError ? "We couldn't load your trips." : null}
        onRetry={() => void refetch()}
        onRowClick={(t) => navigate(`/trips/${t.id}`)}
        search={{
          value: search,
          onChange: (v) => {
            setSearch(v);
            setPage(1);
          },
        }}
        searchPlaceholder="Search trips…"
        toolbar={
          <Select
            value={layout}
            onValueChange={(v) => {
              setLayout(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Trip type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All trip types</SelectItem>
              <SelectItem value="ITINERARY">Multi-day itinerary</SelectItem>
              <SelectItem value="PAGE">Simple page</SelectItem>
            </SelectContent>
          </Select>
        }
        emptyIcon={Footprints}
        emptyTitle={status === "DRAFT" ? "No drafts" : status === "PUBLISHED" ? "Nothing live yet" : "No trips yet"}
        emptyHint={
          status === "PUBLISHED"
            ? "Publish a trip to put it on your website."
            : "Add your first trip: itinerary, price and photos. You can save a draft and finish later."
        }
        emptyAction={
          status !== "PUBLISHED" ? (
            <Button asChild size="sm">
              <Link to="/trips/new">
                <Plus />
                New trip
              </Link>
            </Button>
          ) : undefined
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
    </div>
  );
}
