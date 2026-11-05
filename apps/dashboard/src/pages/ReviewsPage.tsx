import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { api, type Paginated } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/data-table";

type Review = {
  id: number;
  rating: number;
  text: string | null;
  createdAt: string | number;
  activity: { id: number; title: string | null; slug: string } | null;
  reviewer: { id: number; name: string | null; image: string | null } | null;
};

export function ReviewsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data, isLoading } = useQuery({
    queryKey: ["reviews", page, limit],
    queryFn: () => api<Paginated<Review>>("/reviews", { query: { page, limit } }),
  });

  const columns: Column<Review>[] = [
    { key: "reviewer", header: "Who wrote the review", cell: (r) => <span className="font-medium">{r.reviewer?.name ?? "Guest (name not given)"}</span> },
    {
      key: "trip",
      header: "Trip that was reviewed",
      cell: (r) =>
        r.activity ? (
          <Link
            to={`/trips/${r.activity.id}`}
            className="text-muted-foreground hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {r.activity.title ?? "Untitled trip (no title yet)"}
          </Link>
        ) : (
          <span className="text-muted-foreground">Trip no longer exists</span>
        ),
    },
    {
      key: "rating",
      header: "Star rating out of 5",
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={
                  i < r.rating ? "h-3.5 w-3.5 fill-amber-400 text-amber-400" : "h-3.5 w-3.5 text-muted-foreground/40"
                }
              />
            ))}
          </span>
          <span className="text-xs text-muted-foreground">{r.rating} out of 5</span>
        </div>
      ),
    },
    {
      key: "text",
      header: "What the guest wrote",
      className: "max-w-md",
      cell: (r) =>
        r.text ? (
          <span className="line-clamp-2 text-muted-foreground">{r.text}</span>
        ) : (
          <span className="text-muted-foreground">The guest left a rating only, with no written review</span>
        ),
    },
    {
      key: "date",
      header: "Date the review was left",
      className: "text-muted-foreground",
      cell: (r) => new Date(r.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div>
      <PageHeader title="Guest trip reviews" description="Star ratings and written reviews that travellers have left on your trips through your website. You cannot edit these, so travellers know they are honest. Click a review to open the trip it is about." />

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        onRowClick={(r) => r.activity && navigate(`/trips/${r.activity.id}`)}
        emptyIcon={Star}
        emptyTitle="No guest reviews yet"
        emptyHint="A review appears here after a traveller rates one of your trips on your website. To collect more, ask guests to leave a review after they return. For quotes you write yourself, use “Customer testimonials” instead."
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
