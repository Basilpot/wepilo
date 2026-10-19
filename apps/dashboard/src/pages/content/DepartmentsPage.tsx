import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PenLine, Plus, Trash2, Building2 } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Field, FormDialog } from "@/components/form";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { confirmDialog } from "@/components/confirm";
import { useErrorMessage } from "@/pages/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Department = { id: number; name: string | null; description: string | null };

export function DepartmentsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorMessage = useErrorMessage();

  const { data, isLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api<{ data: Department[] }>("/departments"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["departments"] });

  const save = useMutation({
    meta: { success: "Saved" },
    mutationFn: () => {
      const body = { name, description: description || null };
      return editing
        ? api(`/departments/${editing.id}`, { body, method: "PATCH" })
        : api("/departments", { body });
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      setEditing(null);
      setName("");
      setDescription("");
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const remove = useMutation({
    meta: { success: "Deleted" },
    mutationFn: (id: number) => api(`/departments/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const openEdit = (dept: Department) => {
    setEditing(dept);
    setName(dept.name ?? "");
    setDescription(dept.description ?? "");
    setError(null);
    setDialogOpen(true);
  };

  const columns: Column<Department>[] = [
    { key: "name", header: "Name", cell: (d) => <span className="font-medium">{d.name ?? d.id}</span> },
    { key: "description", header: "Description", className: "text-muted-foreground", cell: (d) => d.description ?? "—" },
    {
      key: "actions",
      headClassName: "w-12",
      className: "text-right",
      cell: (dept) => (
        <RowActions
          actions={[
            { label: "Edit department", icon: PenLine, onSelect: () => openEdit(dept) },
            {
              label: "Delete",
              icon: Trash2,
              variant: "destructive",
              separatorBefore: true,
              onSelect: () => confirmDialog({ description: "Delete this department?" }, () => remove.mutate(dept.id)),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Departments"
        description="Organize team members into departments."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setName("");
              setDescription("");
              setError(null);
              setDialogOpen(true);
            }}
          >
            <Plus />
            New department
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(d) => d.id}
        isLoading={isLoading}
        onRowClick={openEdit}
        emptyIcon={Building2}
        emptyTitle="No departments yet"
        emptyHint="Group team members into departments."
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit department" : "New department"}
        onSubmit={() => save.mutate()}
        pending={save.isPending}
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Field label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description">
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </FormDialog>
    </div>
  );
}
