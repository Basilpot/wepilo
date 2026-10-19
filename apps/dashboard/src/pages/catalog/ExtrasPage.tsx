import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PenLine, Plus, Trash2, Package } from "lucide-react";
import { money } from "@/lib/format";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Field, FormDialog } from "@/components/form";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { confirmDialog } from "@/components/confirm";
import { useErrorMessage } from "@/pages/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Extra = {
  id: number;
  type: "ADDON" | "ACCOMMODATION" | "MEAL" | "OTHER";
  name: string;
  description: string | null;
  price: number | null;
};

type FormState = { type: Extra["type"]; name: string; description: string; price: string };
const empty: FormState = { type: "ADDON", name: "", description: "", price: "" };

export function ExtrasPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Extra | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);
  const errorMessage = useErrorMessage();

  const { data, isLoading } = useQuery({
    queryKey: ["extras"],
    queryFn: () => api<{ data: Extra[] }>("/extras"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["extras"] });

  const save = useMutation({
    meta: { success: "Saved" },
    mutationFn: () => {
      const body = {
        type: form.type,
        name: form.name,
        description: form.description || null,
        price: form.price === "" ? null : Number(form.price),
      };
      return editing ? api(`/extras/${editing.id}`, { body, method: "PATCH" }) : api("/extras", { body });
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
    mutationFn: (id: number) => api(`/extras/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const openEdit = (extra: Extra) => {
    setEditing(extra);
    setForm({
      type: extra.type,
      name: extra.name,
      description: extra.description ?? "",
      price: extra.price != null ? String(extra.price) : "",
    });
    setError(null);
    setDialogOpen(true);
  };

  const columns: Column<Extra>[] = [
    {
      key: "name",
      header: "Name",
      cell: (e) => (
        <div>
          <p className="font-medium">{e.name}</p>
          {e.description && <p className="text-sm text-muted-foreground">{e.description}</p>}
        </div>
      ),
    },
    { key: "type", header: "Type", cell: (e) => <Badge variant="secondary">{e.type}</Badge> },
    { key: "price", header: "Price", align: "right", cell: (e) => (e.price != null ? money(e.price) : "Free") },
    {
      key: "actions",
      headClassName: "w-12",
      className: "text-right",
      cell: (extra) => (
        <RowActions
          actions={[
            { label: "Edit extra", icon: PenLine, onSelect: () => openEdit(extra) },
            {
              label: "Delete",
              icon: Trash2,
              variant: "destructive",
              separatorBefore: true,
              onSelect: () => confirmDialog({ description: `Delete extra "${extra.name}"?` }, () => remove.mutate(extra.id)),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Extras"
        description="Add-ons guests can attach to a booking."
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
            New extra
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(e) => e.id}
        isLoading={isLoading}
        onRowClick={openEdit}
        emptyIcon={Package}
        emptyTitle="No extras yet"
        emptyHint="Add add-ons guests can attach to a booking."
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit extra" : "New extra"}
        onSubmit={() => save.mutate()}
        pending={save.isPending}
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Field label="Name" required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Type">
          <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as Extra["type"] }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ADDON">Add-on</SelectItem>
              <SelectItem value="ACCOMMODATION">Accommodation</SelectItem>
              <SelectItem value="MEAL">Meal</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Price per person (USD)" hint="Blank = free.">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
        </Field>
        <Field label="Description">
          <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </Field>
      </FormDialog>
    </div>
  );
}
