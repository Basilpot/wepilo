import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PenLine, Plus, Trash2, FolderTree } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Field, FormDialog } from "@/components/form";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { confirmDialog } from "@/components/confirm";
import { useErrorMessage } from "@/pages/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Category = { id: number; name: string | null; handle: string };

export function PageCategoriesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorMessage = useErrorMessage();

  const { data, isLoading } = useQuery({
    queryKey: ["page-categories"],
    queryFn: () => api<{ data: Category[] }>("/info-page-categories"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["page-categories"] });

  const save = useMutation({
    meta: { success: "Category saved." },
    mutationFn: () => {
      const body = { name, handle: handle || undefined };
      return editing
        ? api(`/info-page-categories/${editing.id}`, { body, method: "PATCH" })
        : api("/info-page-categories", { body });
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      setEditing(null);
      setName("");
      setHandle("");
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const remove = useMutation({
    meta: { success: "Category deleted." },
    mutationFn: (id: number) => api(`/info-page-categories/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const openEdit = (category: Category) => {
    setEditing(category);
    setName(category.name ?? "");
    setHandle(category.handle);
    setError(null);
    setDialogOpen(true);
  };

  const columns: Column<Category>[] = [
    { key: "name", header: "Category name", cell: (c) => <span className="font-medium">{c.name ?? c.handle}</span> },
    { key: "handle", header: "Web address ending (URL slug)", className: "text-muted-foreground", cell: (c) => c.handle },
    {
      key: "actions",
      headClassName: "w-12",
      className: "text-right",
      cell: (category) => (
        <RowActions
          actions={[
            { label: "Edit this category", icon: PenLine, onSelect: () => openEdit(category) },
            {
              label: "Delete this category",
              icon: Trash2,
              variant: "destructive",
              separatorBefore: true,
              onSelect: () => confirmDialog({ title: "Delete this category?", description: "Pages and blog posts in this category will not be deleted, but they will no longer belong to any category.", confirmLabel: "Yes, delete this category", cancelLabel: "No, keep it" }, () => remove.mutate(category.id)),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Page and post categories"
        description="Categories are labels used to group your website pages and blog posts, for example “Travel guides”, “Visa information” or “Company policies”. Create the categories here, then choose one when you edit a page or post."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setName("");
              setHandle("");
              setError(null);
              setDialogOpen(true);
            }}
          >
            <Plus />
            Create a new category
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(c) => c.id}
        isLoading={isLoading}
        onRowClick={openEdit}
        emptyIcon={FolderTree}
        emptyTitle="You have not created any categories yet"
        emptyHint="Categories help visitors find related pages and posts. Select “Create a new category” to add your first one."
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit this category" : "Create a new category"}
        description="Choose a short, clear name that describes the pages and posts that will belong to it."
        submitLabel={editing ? "Save changes to this category" : "Create this category"}
        onSubmit={() => save.mutate()}
        pending={save.isPending}
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Field label="Category name (what visitors will see)" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Web address ending (optional)" hint="This becomes part of the category link on your website. Leave it empty and we create it automatically from the name.">
          <Input value={handle} onChange={(e) => setHandle(e.target.value)} />
        </Field>
      </FormDialog>
    </div>
  );
}
