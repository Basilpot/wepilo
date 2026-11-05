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
    meta: { success: "Website page deleted and removed from your website." },
    mutationFn: (id: number) => api(`/info-pages/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const columns: Column<InfoPage>[] = [
    {
      key: "title",
      header: "Page title and web address",
      cell: (p) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{p.title}</p>
          <p className="truncate text-xs text-muted-foreground">/{p.slug}</p>
        </div>
      ),
    },
    { key: "category", header: "Category", className: "text-muted-foreground", cell: (p) => p.category?.name ?? "No category chosen" },
    {
      key: "nav",
      header: "Linked in the website menu?",
      className: "text-muted-foreground",
      cell: (p) => (p.featuredInNavbar ? <Check aria-label="Yes, this page is linked in the website menu" className="size-4 text-foreground" /> : "No"),
    },
    { key: "status", header: "Visible to the public?", cell: (p) => <StatusBadge kind="content" status={p.published ? "published" : "draft"} /> },
    {
      key: "actions",
      headClassName: "w-12",
      cell: (page) => (
        <RowActions
          actions={[
            { label: "Open this page to edit it", icon: PenLine, onSelect: () => navigate(`/info-pages/${page.id}`) },
            {
              label: "Delete this page",
              icon: Trash2,
              variant: "destructive",
              separatorBefore: true,
              onSelect: () =>
                confirmDialog(
                  { title: "Delete this page permanently?", description: `“${page.title}” will be removed from your website for good and cannot be brought back. Any link to it from other pages will stop working, so consider adding a redirect first.`, confirmLabel: "Yes, delete this page", cancelLabel: "No, keep this page" },
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
        title="Website pages"
        description="Fixed pages on your website that do not change often, such as About us, How to book, Terms and conditions and Privacy policy. Create a new page, or open an existing one to edit its text, search settings and whether it appears in your website menu."
        action={
          <Button asChild>
            <Link to="/info-pages/new">
              <Plus />
              Create a new page
            </Link>
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(p) => p.id}
        isLoading={isLoading}
        error={isError ? "We could not load your website pages. Check your internet connection and try again." : null}
        onRetry={() => void refetch()}
        onRowClick={(p) => navigate(`/info-pages/${p.id}`)}
        emptyIcon={NotebookPen}
        emptyTitle="You have not created any website pages yet"
        emptyHint="Travel websites usually need at least these pages: About us, How to book, Terms and conditions, Cancellation policy and Privacy policy. Select “Create a new page” to add the first one."
        emptyAction={
          <Button asChild size="sm">
            <Link to="/info-pages/new">
              <Plus />
              Create a new page
            </Link>
          </Button>
        }
      />
    </div>
  );
}
