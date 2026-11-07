import { useState } from "react";
import { useTableSearch } from "@/hooks/use-table-search";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, ImageIcon, Star, Trash2 } from "@/components/icons";
import { api, type Paginated } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { StatusBadge, statusOptions } from "@/components/status-badge";
import { confirmDialog } from "@/components/confirm";
import { Thumb } from "@/components/thumb";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDate } from "@/lib/format";
import { CollectReviewsSheet } from "@/pages/reviews/CollectReviewsSheet";

type ReviewStatus = "PENDING" | "PUBLISHED" | "HIDDEN";
type Review = {
  id: number;
  rating: number;
  title: string | null;
  text: string | null;
  images: string[] | null;
  status: ReviewStatus;
  source: "WEBSITE" | "LINK";
  createdAt: string | number;
  author: string;
  reviewerEmail?: string | null;
  activity: { id: number; title: string | null; slug: string } | null;
  reviewer: { id: number; name: string | null; image: string | null } | null;
};

function Stars({ value }: { value: number }) {
  return (
    <span className="flex shrink-0 items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={i < value ? "size-3.5 fill-primary text-primary" : "size-3.5 text-muted-foreground/30"} />
      ))}
    </span>
  );
}

export function ReviewsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState<Review | null>(null);
  const [collecting, setCollecting] = useState(false);
  const tableSearch = useTableSearch(() => setPage(1));

  const { data, isLoading } = useQuery({
    queryKey: ["reviews", page, limit, status, tableSearch.term],
    queryFn: () =>
      api<Paginated<Review>>("/reviews", { query: { page, limit, search: tableSearch.term, status: status === "all" ? undefined : status } }),
  });
  const pending = useQuery({
    queryKey: ["reviews", "pending-count"],
    queryFn: () => api<Paginated<Review>>("/reviews", { query: { limit: 1, status: "PENDING" } }),
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["reviews"] });
  const moderate = useMutation({
    meta: { success: "The review was updated." },
    mutationFn: ({ id, status }: { id: number; status: ReviewStatus }) => api(`/reviews/${id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      refresh();
      setOpen(null);
    },
  });
  const remove = useMutation({
    meta: { success: "The review was deleted." },
    mutationFn: (id: number) => api(`/reviews/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      refresh();
      setOpen(null);
    },
  });

  const confirmDelete = (r: Review) =>
    confirmDialog(
      { title: "Delete this review?", description: "It will be removed for good and no longer counts towards the trip's rating. If you only want to take it off your website, hide it instead." },
      () => remove.mutate(r.id),
    );

  const columns: Column<Review>[] = [
    {
      key: "reviewer",
      header: "Reviewer",
      className: "w-64 min-w-56",
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Thumb round src={r.reviewer?.image} name={r.author} />
          <div className="min-w-0">
            <p className="truncate font-medium">{r.author}</p>
            <p className="truncate text-xs text-muted-foreground">{r.activity?.title ?? "Trip removed"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "text",
      header: "Review",
      cell: (r) => (
        <div className="min-w-0 max-w-2xl space-y-1">
          <div className="flex items-center gap-2">
            <Stars value={r.rating} />
            {r.title && <span className="truncate font-medium">{r.title}</span>}
          </div>
          {r.text && <p className="line-clamp-2 text-muted-foreground">{r.text}</p>}
          {(r.images?.length ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 pt-0.5">
              {r.images!.slice(0, 3).map((url) => (
                <img key={url} src={url} alt="" loading="lazy" className="size-8 rounded-md border object-cover" />
              ))}
              {r.images!.length > 3 && <span className="text-xs text-muted-foreground">+{r.images!.length - 3}</span>}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "whitespace-nowrap",
      cell: (r) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge kind="review" status={r.status} />
          {r.source === "LINK" && <span className="text-xs text-muted-foreground">Via review link</span>}
        </div>
      ),
    },
    { key: "date", header: "Date", className: "whitespace-nowrap text-muted-foreground", cell: (r) => formatDate(r.createdAt as string) },
    {
      key: "actions",
      headClassName: "w-px",
      className: "whitespace-nowrap",
      cell: (r) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {r.status === "PENDING" && (
            <Button size="sm" disabled={moderate.isPending} onClick={() => moderate.mutate({ id: r.id, status: "PUBLISHED" })}>
              Publish
            </Button>
          )}
          <RowActions
            actions={[
              { label: "Publish", icon: Eye, hidden: r.status === "PUBLISHED", onSelect: () => moderate.mutate({ id: r.id, status: "PUBLISHED" }) },
              { label: "Hide from website", icon: EyeOff, hidden: r.status === "HIDDEN", onSelect: () => moderate.mutate({ id: r.id, status: "HIDDEN" }) },
              { label: "Delete", icon: Trash2, variant: "destructive", separatorBefore: true, onSelect: () => confirmDelete(r) },
            ]}
          />
        </div>
      ),
    },
  ];

  const awaiting = pending.data?.pagination.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Reviews"
        description="What travellers said after their trips with you. Send a review link or QR code to past travellers, then read what comes in and publish the ones you want on your website. Nothing appears until you approve it."
        action={
          <Button onClick={() => setCollecting(true)}>
            <Star />
            Collect reviews
          </Button>
        }
      />

      <DataTable
        search={tableSearch.search}
        searchPlaceholder="Search reviews…"
        toolbar={
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-52" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reviews</SelectItem>
              {statusOptions("review").map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                  {o.value === "PENDING" && awaiting > 0 ? ` (${awaiting})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        onRowClick={setOpen}
        emptyIcon={Star}
        emptyTitle={status === "all" ? "No reviews yet" : "Nothing here"}
        emptyHint={
          status === "all"
            ? "Share a review link with past travellers to get started. They write their review on a simple page, and it lands here for you to approve."
            : "No reviews match this filter."
        }
        emptyAction={
          status === "all" ? (
            <Button size="sm" variant="outline" onClick={() => setCollecting(true)}>
              Get review link
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

      <CollectReviewsSheet open={collecting} onOpenChange={setCollecting} />

      <Sheet open={Boolean(open)} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          {open && (
            <>
              <SheetHeader className="space-y-2 px-6 pt-6 pb-4 pr-14">
                <div className="flex items-center gap-3">
                  <SheetTitle className="text-xl font-semibold tracking-tight">{open.author}</SheetTitle>
                  <StatusBadge kind="review" status={open.status} />
                </div>
                <SheetDescription>
                  {open.activity ? (
                    <>
                      Review of{" "}
                      <Link to={`/trips/${open.activity.id}`} className="underline underline-offset-4">
                        {open.activity.title ?? "Untitled trip"}
                      </Link>
                    </>
                  ) : (
                    "Review"
                  )}
                  {" · "}
                  {formatDate(open.createdAt as string)}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6">
                <div className="flex items-center gap-3">
                  <Stars value={open.rating} />
                  <span className="text-sm text-muted-foreground">{open.rating} out of 5</span>
                </div>
                {open.title && <h3 className="text-lg font-semibold tracking-tight">{open.title}</h3>}
                <p className="text-[15px] leading-relaxed whitespace-pre-line">{open.text || "No written review."}</p>
                {(open.images?.length ?? 0) > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {open.images!.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border">
                        <img src={url} alt="" className="aspect-square size-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                {open.reviewerEmail && (
                  <p className="text-sm text-muted-foreground">
                    Reviewer's email (private):{" "}
                    <a href={`mailto:${open.reviewerEmail}`} className="underline underline-offset-4">
                      {open.reviewerEmail}
                    </a>
                  </p>
                )}
                {open.status === "PENDING" && (
                  <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                    This review is not on your website yet. Publish it to show it there and count it towards the trip's rating.
                  </p>
                )}
              </div>
              <SheetFooter className="flex-row gap-3 border-t bg-muted/50 px-6 py-4">
                <Button variant="ghost" size="lg" className="text-destructive hover:text-destructive" onClick={() => confirmDelete(open)}>
                  Delete
                </Button>
                <div className="ml-auto flex gap-3">
                  {open.status !== "HIDDEN" && (
                    <Button variant="secondary" size="lg" disabled={moderate.isPending} onClick={() => moderate.mutate({ id: open.id, status: "HIDDEN" })}>
                      Hide
                    </Button>
                  )}
                  {open.status !== "PUBLISHED" && (
                    <Button size="lg" disabled={moderate.isPending} onClick={() => moderate.mutate({ id: open.id, status: "PUBLISHED" })}>
                      Publish
                    </Button>
                  )}
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
