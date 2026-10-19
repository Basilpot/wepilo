import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, NotebookPen, PenLine, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { confirmDialog } from "@/components/confirm";
import { Button } from "@/components/ui/button";

type InfoPage = {
  id: number;
  title: string;
  slug: string;
  published: boolean;
  featuredInNavbar: boolean;
  category: { id: number; name: string | null } | null;
};


export function InfoPagesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["info-pages"],
    queryFn: () => api<{ data: InfoPage[] }>("/info-pages"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["info-pages"] });

  const remove = useMutation({
    meta: { success: "Page deleted" },
    mutationFn: (id: number) => api(`/info-pages/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const columns: Column<InfoPage>[] = [
    {
      key: "title",
      header: "Page",
      cell: (p) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{p.title}</p>
          <p className="truncate text-xs text-muted-foreground">/{p.slug}</p>
        </div>
      ),
    },
    { key: "category", header: "Category", className: "text-muted-foreground", cell: (p) => p.category?.name ?? "—" },
    {
      key: "nav",
      header: "In navigation",
      className: "text-muted-foreground",
      cell: (p) => (p.featuredInNavbar ? <Check aria-label="Yes" className="size-4 text-foreground" /> : "—"),
    },
    { key: "status", header: "Status", cell: (p) => <StatusBadge kind="content" status={p.published ? "published" : "draft"} /> },
    {
      key: "actions",
      headClassName: "w-12",
      cell: (page) => (
        <RowActions
          actions={[
            { label: "Edit page", icon: PenLine, onSelect: () => navigate(`/info-pages/${page.id}`) },
            {
              label: "Delete",
              icon: Trash2,
              variant: "destructive",
              separatorBefore: true,
              onSelect: () =>
                confirmDialog(
                  { title: "Delete page?", description: `“${page.title}” will be removed from your site. This can't be undone.` },
                  () => remove.mutate(page.id),
                ),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Pages"
        description="Static pages like About us, How to book, Terms and Privacy."
        action={
          <Button asChild>
            <Link to="/info-pages/new">
              <Plus />
              New page
            </Link>
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(p) => p.id}
        isLoading={isLoading}
        error={isError ? "We couldn't load your pages." : null}
        onRetry={() => void refetch()}
        onRowClick={(p) => navigate(`/info-pages/${p.id}`)}
        emptyIcon={NotebookPen}
        emptyTitle="No pages yet"
        emptyHint="Most sites need About us, How to book, Terms and Privacy."
        emptyAction={
          <Button asChild size="sm">
            <Link to="/info-pages/new">
              <Plus />
              New page
            </Link>
          </Button>
        }
      />
    </div>
  );
}
