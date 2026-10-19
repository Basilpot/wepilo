import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PenLine, Plus, Trash2, Contact2 } from "lucide-react";
import { api } from "@/lib/api";
import { ImageField } from "@/components/image-field";
import { PageHeader } from "@/components/PageHeader";
import { Field, FormDialog } from "@/components/form";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { confirmDialog } from "@/components/confirm";
import { useErrorMessage } from "@/pages/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Department = { id: number; name: string | null };
type Member = {
  id: number;
  name: string;
  designation: string | null;
  about: string | null;
  image: string | null;
  departmentId: number | null;
  department: { id: number; name: string | null } | null;
};

type FormState = {
  name: string;
  designation: string;
  about: string;
  image: string;
  departmentId: string;
};

const empty: FormState = { name: "", designation: "", about: "", image: "", departmentId: "" };

export function TeamPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);
  const errorMessage = useErrorMessage();

  const { data, isLoading } = useQuery({
    queryKey: ["team"],
    queryFn: () => api<{ departments: Department[]; members: Member[] }>("/team"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["team"] });

  const save = useMutation({
    meta: { success: "Saved" },
    mutationFn: () => {
      const body = {
        name: form.name,
        designation: form.designation || null,
        about: form.about || null,
        image: form.image || null,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
      };
      return editing ? api(`/team/${editing.id}`, { body, method: "PATCH" }) : api("/team", { body });
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      setEditing(null);
      setForm(empty);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const remove = useMutation({
    meta: { success: "Deleted" },
    mutationFn: (id: number) => api(`/team/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const openEdit = (member: Member) => {
    setEditing(member);
    setForm({
      name: member.name,
      designation: member.designation ?? "",
      about: member.about ?? "",
      image: member.image ?? "",
      departmentId: member.departmentId ? String(member.departmentId) : "",
    });
    setError(null);
    setDialogOpen(true);
  };

  const columns: Column<Member>[] = [
    {
      key: "member",
      header: "Member",
      cell: (m) => (
        <div className="flex items-center gap-3">
          {m.image ? (
            <img src={m.image} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
              {m.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <p className="font-medium">{m.name}</p>
            <p className="text-xs text-muted-foreground">{m.designation ?? "—"}</p>
          </div>
        </div>
      ),
    },
    { key: "department", header: "Department", cell: (m) => m.department?.name ?? "—" },
    {
      key: "about",
      header: "About",
      className: "max-w-md",
      cell: (m) => <span className="line-clamp-2 text-muted-foreground">{m.about ?? "—"}</span>,
    },
    {
      key: "actions",
      headClassName: "w-12",
      className: "text-right",
      cell: (member) => (
        <RowActions
          actions={[
            { label: "Edit member", icon: PenLine, onSelect: () => openEdit(member) },
            {
              label: "Remove",
              icon: Trash2,
              variant: "destructive",
              separatorBefore: true,
              onSelect: () => confirmDialog({ description: `Remove ${member.name}?` }, () => remove.mutate(member.id)),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Team"
        description="People shown on your public site."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setForm(empty);
              setError(null);
              setDialogOpen(true);
            }}
          >
            <Plus />
            Add member
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={data?.members ?? []}
        getRowId={(m) => m.id}
        isLoading={isLoading}
        onRowClick={openEdit}
        emptyIcon={Contact2}
        emptyTitle="No team members yet"
        emptyHint="Add the people shown on your public site."
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit member" : "Add member"}
        onSubmit={() => save.mutate()}
        pending={save.isPending}
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Field label="Name" required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Designation">
          <Input value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} />
        </Field>
        <Field label="About">
          <Textarea rows={3} value={form.about} onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))} />
        </Field>
        <Field label="Photo">
          <ImageField shape="avatar" label="Add photo" value={form.image} onChange={(url) => setForm((f) => ({ ...f, image: url }))} />
        </Field>
        <Field label="Department">
          <Select
            value={form.departmentId || "none"}
            onValueChange={(v) => setForm((f) => ({ ...f, departmentId: v === "none" ? "" : v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {data?.departments.map((dept) => (
                <SelectItem key={dept.id} value={String(dept.id)}>
                  {dept.name ?? dept.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FormDialog>
    </div>
  );
}
