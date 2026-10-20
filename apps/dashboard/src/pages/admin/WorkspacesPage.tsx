import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, Plus } from "lucide-react";
import { api, type Paginated } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { PLAN_NAMES } from "@/pages/billing/billing";
import { workspaceState, type WorkspaceSummary } from "./admin-api";

type Overview = { total: number; active: number; trial: number; locked: number; managed: number; suspended: number };

export function WorkspacesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const overview = useQuery({
    queryKey: ["platform", "overview"],
    queryFn: () => api<Overview>("/platform/tenants/overview"),
  });
  const list = useQuery({
    queryKey: ["platform", "tenants", page, limit, query],
    queryFn: () => api<Paginated<WorkspaceSummary>>("/platform/tenants", { query: { page, limit, search: query } }),
  });

  const columns: Column<WorkspaceSummary>[] = [
    {
      key: "name",
      header: "Workspace",
      cell: (w) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{w.companyName ?? w.slug}</p>
          <p className="truncate text-xs text-muted-foreground">{w.email}</p>
        </div>
      ),
    },
    { key: "state", header: "Status", cell: (w) => <StatusBadge kind="workspace" status={workspaceState(w)} /> },
    {
      key: "plan",
      header: "Plan",
      cell: (w) => (
        <span className="whitespace-nowrap">
          {PLAN_NAMES[w.plan]}
          {w.billingMode === "MANUAL" && <span className="ml-1.5 text-xs text-muted-foreground">· managed</span>}
        </span>
      ),
    },
    {
      key: "ends",
      header: "Access until",
      className: "whitespace-nowrap text-muted-foreground",
      cell: (w) => (w.planExpiresAt ? formatDate(w.planExpiresAt) : w.access.locked ? "—" : "No end date"),
    },
    {
      key: "created",
      header: "Created",
      className: "whitespace-nowrap text-muted-foreground",
      cell: (w) => formatDate(w.createdAt),
    },
  ];

  const o = overview.data;
  const stats = o
    ? [
        { label: "Workspaces", value: o.total },
        { label: "Active", value: o.active },
        { label: "On trial", value: o.trial },
        { label: "Locked", value: o.locked },
        { label: "Managed plans", value: o.managed },
      ]
    : null;

  return (
    <div>
      <PageHeader
        title="Workspaces"
        description="Every agency on Wepilo. Create one here to set up an enterprise deal and hand it over."
        action={
          <Button asChild>
            <Link to="/admin/workspaces/new">
              <Plus />
              New workspace
            </Link>
          </Button>
        }
      />

      {stats && (
        <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="bg-card px-4 py-3">
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <DataTable
        columns={columns}
        rows={list.data?.data ?? []}
        getRowId={(w) => w.id}
        isLoading={list.isLoading}
        error={list.isError ? "Couldn't load workspaces." : null}
        onRetry={() => list.refetch()}
        onRowClick={(w) => navigate(`/admin/workspaces/${w.id}`)}
        search={{ value: search, onChange: setSearch }}
        searchPlaceholder="Search name, slug or email…"
        emptyIcon={Building2}
        emptyTitle={query ? "No workspaces match" : "No workspaces yet"}
        emptyHint={query ? undefined : "Agencies appear here when they sign up or when you create one."}
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
