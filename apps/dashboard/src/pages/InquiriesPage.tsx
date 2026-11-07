import { useState } from "react";
import { useTableSearch } from "@/hooks/use-table-search";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox } from "@/components/icons";
import { api, type Paginated } from "@/lib/api";
import { StatusBadge, statusInfo, statusOptions } from "@/components/status-badge";
import { PageHeader } from "@/components/PageHeader";
import { ContactActions } from "@/components/contact-actions";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Inquiry = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  trip: string | null;
  message: string;
  status: "NEW" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  createdAt: string | number;
};

const NEXT: Record<Inquiry["status"], Inquiry["status"][]> = {
  NEW: ["IN_PROGRESS", "CLOSED"],
  IN_PROGRESS: ["RESOLVED", "CLOSED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

const ACTION_LABEL: Record<Inquiry["status"], string> = {
  NEW: "Mark as new",
  IN_PROGRESS: "Mark in progress",
  RESOLVED: "Mark resolved",
  CLOSED: "Close inquiry",
};

function receivedLabel(value: string | number) {
  const then = new Date(value);
  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function InquiriesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const tableSearch = useTableSearch(() => setPage(1));
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState<Inquiry | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["inquiries", page, limit, status, tableSearch.term],
    queryFn: () =>
      api<Paginated<Inquiry>>("/inquiries", {
        query: { page, limit, status: status === "all" ? undefined : status, search: tableSearch.term },
      }),
    placeholderData: (prev) => prev,
  });

  const update = useMutation({
    meta: { success: "Inquiry status updated. The new status is now saved." },
    mutationFn: ({ id, next }: { id: number; next: Inquiry["status"] }) =>
      api(`/inquiries/${id}/status`, { body: { status: next }, method: "PATCH" }),
    onSuccess: (_d, { next }) => {
      setOpen((o) => (o ? { ...o, status: next } : o));
      void queryClient.invalidateQueries({ queryKey: ["inquiries"] });
    },
  });

  const columns: Column<Inquiry>[] = [
    {
      key: "from",
      header: "From",
      cell: (i) => (
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className={cn("size-2 shrink-0 rounded-full", i.status === "NEW" ? "bg-muted" : "bg-transparent")}
          />
          <div className="min-w-0">
            <p className={cn("truncate", i.status === "NEW" ? "font-semibold" : "font-medium")}>{i.name}</p>
            <p className="truncate text-xs text-muted-foreground">{i.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "trip",
      header: "About",
      className: "max-w-md",
      cell: (i) => (
        <div className="min-w-0">
          <p className="truncate">{i.trip ?? "General inquiry"}</p>
          {i.message && <p className="truncate text-xs text-muted-foreground">{i.message}</p>}
        </div>
      ),
    },
    { key: "status", header: "Status", cell: (i) => <StatusBadge kind="inquiry" status={i.status} /> },
    {
      key: "received",
      header: "Received",
      className: "whitespace-nowrap text-muted-foreground",
      cell: (i) => receivedLabel(i.createdAt),
    },
    {
      key: "actions",
      headClassName: "w-12",
      cell: (inquiry) => (
        <RowActions
          actions={NEXT[inquiry.status].map((next) => ({
            label: ACTION_LABEL[next],
            onSelect: () => update.mutate({ id: inquiry.id, next }),
          }))}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Inquiries" description="Every question a traveller sent through a contact or trip form on your website. Click an inquiry to read the full message and reply by email, phone or WhatsApp. Replying quickly makes a booking much more likely." />

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
              {statusOptions("inquiry").map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        search={tableSearch.search}
        searchPlaceholder="Search by name, email or trip…"
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(i) => i.id}
        isLoading={isLoading}
        error={isError ? "We could not load your customer inquiries. Check your internet connection and try again." : null}
        onRetry={() => void refetch()}
        onRowClick={setOpen}
        emptyIcon={Inbox}
        emptyTitle={status === "all" ? "No customer inquiries yet" : `No inquiries are currently marked "${statusInfo("inquiry", status).label}"`}
        emptyHint="When a traveller fills in a form on your website, their message appears here and we also send you an email. Make sure your website has a contact form or trip inquiry form so travellers can reach you."
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
                  <SheetTitle className="text-base">{open.name}</SheetTitle>
                  <StatusBadge kind="inquiry" status={open.status} />
                </div>
                <SheetDescription>
                  {open.trip ?? "General inquiry"} · {receivedLabel(open.createdAt)}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
                <ContactActions name={open.name} email={open.email} phone={open.phone} subject={open.trip ?? undefined} />
                <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="truncate">
                    <a href={`mailto:${open.email}`} className="hover:underline">
                      {open.email}
                    </a>
                  </dd>
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd>{open.phone || "—"}</dd>
                  <dt className="text-muted-foreground">Received</dt>
                  <dd>{new Date(open.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</dd>
                </dl>
                <div>
                  <h3 className="mb-2 text-sm font-medium">Message</h3>
                  <p className="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">{open.message}</p>
                </div>
              </div>
              {NEXT[open.status].length > 0 && (
                <div className="flex justify-end gap-2 border-t bg-muted/30 px-6 py-3">
                  {NEXT[open.status].map((next, i, arr) => (
                    <Button
                      key={next}
                      variant={i === 0 && arr.length > 1 ? "default" : "outline"}
                      disabled={update.isPending}
                      onClick={() => update.mutate({ id: open.id, next })}
                    >
                      {ACTION_LABEL[next]}
                    </Button>
                  ))}
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
