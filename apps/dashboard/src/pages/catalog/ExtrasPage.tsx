import { MoneyInput } from "@/components/money-input";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PenLine, Plus, Trash2, Package } from "@/components/icons";
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
    meta: { success: "Optional add-on saved." },
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
    meta: { success: "Optional add-on deleted." },
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
              onSelect: () => confirmDialog({ title: `Delete the add-on "${extra.name}"?`, description: "Travellers will no longer be able to add it to a booking. Bookings that already include it are not changed." }, () => remove.mutate(extra.id)),
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
        description="Extra services travellers can add to a booking for an additional price, such as a hotel upgrade, airport pickup, equipment rental or meals. Create each add-on once here."
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
        emptyHint="Add-ons let you earn more from each booking. Examples: private room upgrade, airport transfer, trekking gear rental, extra night. Select “New extra” to add your first one."
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit extra" : "New extra"}
        description="Describe what the traveller gets and how much it costs per person."
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
        <Field label="Price per person" hint="Leave this empty if the add-on is free of charge.">
          <MoneyInput value={form.price} onChange={(v) => setForm((f) => ({ ...f, price: v }))} placeholder="0.00" />
        </Field>
        <Field label="Description" hint="Explain what is included so travellers know exactly what they are paying for.">
          <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </Field>
      </FormDialog>
    </div>
  );
}
