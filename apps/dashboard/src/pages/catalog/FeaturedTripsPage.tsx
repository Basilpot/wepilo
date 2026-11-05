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
    meta: { success: "Homepage featured trips updated. The change is live on your website." },
    mutationFn: ({ id, isFeatured }: { id: number; isFeatured: boolean }) =>
      api(`/activities/${id}`, { body: { isFeatured }, method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["featured-trips"] }),
  });

  const columns: Column<Trip>[] = [
    { key: "title", header: "Trip name", cell: (t) => <span className="font-medium">{t.title ?? "Untitled trip (no title yet)"}</span> },
    {
      key: "status",
      header: "Visible to the public?",
      cell: (t) => <StatusBadge kind="trip" status={t.status} />,
    },
    { key: "category", header: "Trip category", className: "text-muted-foreground", cell: (t) => t.tripCategory?.name ?? "No category chosen" },
    { key: "price", header: "Starting price", align: "right", cell: (t) => (t.price != null ? money(t.price) : "No price set") },
    {
      key: "featured",
      header: "Shown as featured on homepage?",
      cell: (t) => (t.isFeatured ? <Badge>Featured</Badge> : <span className="text-muted-foreground">Not featured</span>),
    },
    {
      key: "actions",
      headClassName: "w-12",
      className: "text-right",
      cell: (trip) => (
        <RowActions
          actions={[
            {
              label: trip.isFeatured ? "Stop featuring this trip" : "Feature this trip on the homepage",
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
      <PageHeader title="Homepage featured trips" description="Choose which trips are highlighted as featured on your website, usually on the homepage. Open the actions menu on any row to start or stop featuring a trip. Click a row to edit the trip itself." />

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(t) => t.id}
        isLoading={isLoading}
        onRowClick={(t) => navigate(`/trips/${t.id}`)}
        emptyIcon={MapPinCheck}
        emptyTitle="You have no trips to feature yet"
        emptyHint="Create and publish a trip first. After that, it will appear in this list and you can choose to feature it on your homepage."
      />
    </div>
  );
}
