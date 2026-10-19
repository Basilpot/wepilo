import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Star, StarOff, MapPinCheck } from "lucide-react";
import { money } from "@/lib/format";
import { api, type Paginated } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";

type Trip = {
  id: number;
  title: string | null;
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  isFeatured: boolean;
  price: number | null;
  tripCategory: { id: number; name: string | null } | null;
};

export function FeaturedTripsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["featured-trips"],
    queryFn: () => api<Paginated<Trip>>("/activities", { query: { limit: 100, sort: "popular" } }),
  });

  const toggle = useMutation({
    meta: { success: "Updated" },
    mutationFn: ({ id, isFeatured }: { id: number; isFeatured: boolean }) =>
      api(`/activities/${id}`, { body: { isFeatured }, method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["featured-trips"] }),
  });

  const columns: Column<Trip>[] = [
    { key: "title", header: "Trip", cell: (t) => <span className="font-medium">{t.title ?? "Untitled"}</span> },
    {
      key: "status",
      header: "Status",
      cell: (t) => <StatusBadge kind="trip" status={t.status} />,
    },
    { key: "category", header: "Category", className: "text-muted-foreground", cell: (t) => t.tripCategory?.name ?? "—" },
    { key: "price", header: "Price", align: "right", cell: (t) => (t.price != null ? money(t.price) : "—") },
    {
      key: "featured",
      header: "Featured",
      cell: (t) => (t.isFeatured ? <Badge>Featured</Badge> : <span className="text-muted-foreground">—</span>),
    },
    {
      key: "actions",
      headClassName: "w-12",
      className: "text-right",
      cell: (trip) => (
        <RowActions
          actions={[
            {
              label: trip.isFeatured ? "Unfeature" : "Feature",
              icon: trip.isFeatured ? StarOff : Star,
              disabled: toggle.isPending,
              onSelect: () => toggle.mutate({ id: trip.id, isFeatured: !trip.isFeatured }),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Featured trips" description="Toggle which trips show as featured." />

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(t) => t.id}
        isLoading={isLoading}
        onRowClick={(t) => navigate(`/trips/${t.id}`)}
        emptyIcon={MapPinCheck}
        emptyTitle="No trips yet"
        emptyHint="Create a trip first."
      />
    </div>
  );
}
