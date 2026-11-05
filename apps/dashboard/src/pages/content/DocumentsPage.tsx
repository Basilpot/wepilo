import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, PenLine, Plus, Trash2 } from "lucide-react";
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
      header: "Document name",
      cell: (d) => (
        <span className="flex items-center gap-2 font-medium">
          <FileText className="h-4 w-4 text-muted-foreground" />
          {d.title}
        </span>
      ),
    },
    { key: "path", header: "Where the file is stored", className: "font-mono text-sm text-muted-foreground", cell: (d) => d.path },
    {
      key: "status",
      header: "Visible to the public?",
      cell: (d) => <StatusBadge kind="content" status={d.published ? "published" : "draft"} />,
    },
    {
      key: "actions",
      headClassName: "w-12",
      className: "text-right",
      cell: (doc) => (
        <RowActions
          actions={[
            { label: "Edit this document", icon: PenLine, onSelect: () => openEdit(doc) },
            {
              label: "Delete this document",
              icon: Trash2,
              variant: "destructive",
              separatorBefore: true,
              onSelect: () => confirmDialog({ title: `Delete the document “${doc.title}”?`, description: "It will be removed from your website. The file itself stays in your media library.", confirmLabel: "Yes, delete this document", cancelLabel: "No, keep it" }, () => remove.mutate(doc.id)),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Licences and certificates"
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
            Add a licence or certificate
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
        emptyTitle="You have not added any licences or certificates yet"
        emptyHint="First upload the PDF or image in the “Media library”. Then select “Add a licence or certificate” here and paste the file’s location."
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit this licence or certificate" : "Add a licence or certificate"}
        description="Give the document a clear name and tell us where the file is."
        submitLabel={editing ? "Save changes to this document" : "Add this document"}
        onSubmit={() => save.mutate()}
        pending={save.isPending}
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Field label="Document name (what visitors will see)" required hint="Example: Nepal Tourism Board licence">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Where is the file? (file location or web address)" required hint="Upload the file in the “Media library” first, open it, choose “Copy the file link”, and paste that link here.">
          <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/media/file/..." />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={published} onCheckedChange={(v) => setPublished(v === true)} />
          Show this document on my public website
        </label>
      </FormDialog>
    </div>
  );
}
