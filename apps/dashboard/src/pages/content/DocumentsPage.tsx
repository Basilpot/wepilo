import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, PenLine, Plus, Trash2 } from "@/components/icons";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/PageHeader";
import { Field, FormDialog } from "@/components/form";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { confirmDialog } from "@/components/confirm";
import { useErrorMessage } from "@/pages/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

type Document = {
  id: number;
  title: string;
  path: string;
  published: boolean;
  createdAt: string | number;
};

export function DocumentsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Document | null>(null);
  const [title, setTitle] = useState("");
  const [path, setPath] = useState("");
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorMessage = useErrorMessage();

  const { data, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => api<{ data: Document[] }>("/documents/all"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["documents"] });

  const save = useMutation({
    meta: { success: "Document saved." },
    mutationFn: () => {
      const body = { title, path, published };
      return editing
        ? api(`/documents/${editing.id}`, { body, method: "PATCH" })
        : api("/documents", { body });
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      setEditing(null);
      setTitle("");
      setPath("");
      setPublished(false);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const remove = useMutation({
    meta: { success: "Document deleted." },
    mutationFn: (id: number) => api(`/documents/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const openEdit = (doc: Document) => {
    setEditing(doc);
    setTitle(doc.title);
    setPath(doc.path);
    setPublished(doc.published);
    setError(null);
    setDialogOpen(true);
  };

  const columns: Column<Document>[] = [
    {
      key: "title",
      header: "Title",
      cell: (d) => (
        <span className="flex items-center gap-2 font-medium">
          <FileText className="h-4 w-4 text-muted-foreground" />
          {d.title}
        </span>
      ),
    },
    { key: "path", header: "Path", className: "font-mono text-sm text-muted-foreground", cell: (d) => d.path },
    {
      key: "status",
      header: "Status",
      cell: (d) => <StatusBadge kind="content" status={d.published ? "published" : "draft"} />,
    },
    {
      key: "actions",
      headClassName: "w-12",
      className: "text-right",
      cell: (doc) => (
        <RowActions
          actions={[
            { label: "Edit document", icon: PenLine, onSelect: () => openEdit(doc) },
            {
              label: "Delete",
              icon: Trash2,
              variant: "destructive",
              separatorBefore: true,
              onSelect: () => confirmDialog({ description: `Delete "${doc.title}"?` }, () => remove.mutate(doc.id)),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Official papers that prove your business is trustworthy, such as your tourism licence, company registration, insurance and association memberships. Travellers can open the ones you publish from your website."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setTitle("");
              setPath("");
              setPublished(false);
              setError(null);
              setDialogOpen(true);
            }}
          >
            <Plus />
            New document
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(d) => d.id}
        isLoading={isLoading}
        onRowClick={openEdit}
        emptyIcon={FileText}
        emptyTitle="No documents"
        emptyHint="First upload the PDF or image in the “Media”. Then select “New document” here and paste the file’s location."
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit document" : "New document"}
        description="Give the document a clear name and tell us where the file is."
        onSubmit={() => save.mutate()}
        pending={save.isPending}
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Field label="Title" required hint="Example: Nepal Tourism Board licence">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Path or URL" required hint="Upload the file in the “Media” first, open it, choose “Copy link”, and paste that link here.">
          <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/media/file/..." />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={published} onCheckedChange={(v) => setPublished(v === true)} />
          Published
        </label>
      </FormDialog>
    </div>
  );
}
