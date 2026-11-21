import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LifeBuoy } from "@/components/icons";
import { api, type Paginated } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type PlatformTicket = {
  id: number;
  subject: string;
  category: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  creatorName: string | null;
  createdAt: string;
  tenant: { id: number; companyName: string | null; slug: string; email: string; plan: string } | null;
  creator: { id: number; name: string; email: string } | null;
  replyCount: number;
};

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

/** Every support request an agency has sent, across every workspace. */
export function SupportInboxPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("ALL");

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const list = useQuery({
    queryKey: ["platform", "support", page, limit, query, status],
    queryFn: () =>
      api<Paginated<PlatformTicket>>("/platform/support", {
        query: { page, limit, search: query, status: status === "ALL" ? undefined : status },
      }),
  });

  const columns: Column<PlatformTicket>[] = [
    {
      key: "workspace",
      header: "Workspace",
      cell: (t) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{t.tenant?.companyName ?? t.tenant?.slug ?? "—"}</p>
          <p className="truncate text-xs text-muted-foreground">{t.tenant?.email}</p>
        </div>
      ),
    },
    {
      key: "subject",
      header: "Request",
      cell: (t) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{t.subject}</p>
          <p className="truncate text-xs text-muted-foreground">
            {t.category} · {t.creatorName ?? t.creator?.name ?? "Someone"}
          </p>
        </div>
      ),
    },
    { key: "status", header: "Status", cell: (t) => <StatusBadge kind="ticket" status={t.status} /> },
    { key: "priority", header: "Priority", cell: (t) => <StatusBadge kind="priority" status={t.priority} /> },
    {
      key: "replies",
      header: "Replies",
      className: "whitespace-nowrap text-muted-foreground",
      cell: (t) => (t.replyCount ? String(t.replyCount) : "—"),
    },
    {
      key: "sent",
      header: "Sent",
      className: "whitespace-nowrap text-muted-foreground",
      cell: (t) => formatDate(t.createdAt),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Support"
        description="Every request an agency has sent, across every workspace. Answer one and the agency is emailed straight away. New requests also come to the support inbox by email."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger size="sm" className="w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "IN_PROGRESS" ? "In progress" : s[0] + s.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={list.data?.data ?? []}
        getRowId={(t) => t.id}
        isLoading={list.isLoading}
        error={list.isError ? "We could not load the support requests. Check your internet connection and try again." : null}
        onRetry={() => list.refetch()}
        onRowClick={(t) => navigate(`/admin/support/${t.id}`)}
        search={{ value: search, onChange: setSearch }}
        searchPlaceholder="Search a subject or message…"
        emptyIcon={LifeBuoy}
        emptyTitle={query ? "No requests match" : "No support requests yet"}
        emptyHint={
          query
            ? undefined
            : "A request appears here when an agency writes to support from their dashboard. Everyone also gets an email."
        }
        pagination={
          list.data
            ? {
                page: list.data.pagination.page,
                totalPages: list.data.pagination.totalPages,
                total: list.data.pagination.total,
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
