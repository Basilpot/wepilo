import { Switch } from "@/components/ui/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { MapPinCheck } from "@/components/icons";
import { money } from "@/lib/format";
import { api, type Paginated } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/data-table";

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
    meta: { success: "Featured trips updated. The change is live on your website." },
    mutationFn: ({ id, isFeatured }: { id: number; isFeatured: boolean }) =>
      api(`/activities/${id}`, { body: { isFeatured }, method: "PATCH" }),
    onMutate: ({ id, isFeatured }) => {
      queryClient.setQueryData<Paginated<Trip>>(["featured-trips"], (old) =>
        old ? { ...old, data: old.data.map((t) => (t.id === id ? { ...t, isFeatured } : t)) } : old,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["featured-trips"] }),
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
      header: "On homepage",
      align: "right",
      headClassName: "w-32",
      cell: (trip) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={trip.isFeatured}
            disabled={toggle.isPending && toggle.variables?.id === trip.id}
            onCheckedChange={(isFeatured) => toggle.mutate({ id: trip.id, isFeatured })}
            aria-label={trip.isFeatured ? `Stop featuring ${trip.title ?? "this trip"}` : `Feature ${trip.title ?? "this trip"} on the homepage`}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Featured trips" description="Choose which trips are highlighted as featured on your website, usually on the homepage. Use the switch on a row to start or stop featuring that trip. Click anywhere else on the row to edit the trip itself." />

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(t) => t.id}
        isLoading={isLoading}
        onRowClick={(t) => navigate(`/trips/${t.id}`)}
        emptyIcon={MapPinCheck}
        emptyTitle="No trips yet"
        emptyHint="Create and publish a trip first. After that, it will appear in this list and you can choose to feature it on your homepage."
      />
    </div>
  );
}
