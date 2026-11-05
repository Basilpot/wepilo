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
    meta: { success: "Department saved." },
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
    meta: { success: "Department deleted." },
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
    { key: "name", header: "Department name", cell: (d) => <span className="font-medium">{d.name ?? d.id}</span> },
    { key: "description", header: "What this department does", className: "text-muted-foreground", cell: (d) => d.description ?? "No description added" },
    {
      key: "actions",
      headClassName: "w-12",
      className: "text-right",
      cell: (dept) => (
        <RowActions
          actions={[
            { label: "Edit this department", icon: PenLine, onSelect: () => openEdit(dept) },
            {
              label: "Delete this department",
              icon: Trash2,
              variant: "destructive",
              separatorBefore: true,
              onSelect: () => confirmDialog({ title: "Delete this department?", description: "Team members in this department are not deleted. They will simply no longer belong to any department.", confirmLabel: "Yes, delete this department", cancelLabel: "No, keep it" }, () => remove.mutate(dept.id)),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Team departments"
        description="Groups such as Guides, Operations or Sales that organise the people on your website’s team page. Create a department here first, then choose it when you add or edit a team member."
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
            Create a new department
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
        emptyTitle="You have not created any departments yet"
        emptyHint="Departments are optional. They help visitors see who does what on your team. Select “Create a new department” to add the first one."
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit this department" : "Create a new department"}
        submitLabel={editing ? "Save changes to this department" : "Create this department"}
        onSubmit={() => save.mutate()}
        pending={save.isPending}
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Field label="Department name" required hint="Example: Guides, Operations, Customer support">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Short description (optional)" hint="One or two sentences explaining what this team is responsible for.">
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </FormDialog>
    </div>
  );
}
