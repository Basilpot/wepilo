import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Redo } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Field, FormDialog } from "@/components/form";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { confirmDialog } from "@/components/confirm";
import { useErrorMessage } from "@/pages/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

type Redirect = {
  id: number;
  from: string;
  to: string;
  permanent: boolean;
  createdAt: string | number;
};

export function RedirectsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [permanent, setPermanent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const errorMessage = useErrorMessage();

  const { data, isLoading } = useQuery({
    queryKey: ["redirects"],
    queryFn: () => api<{ data: Redirect[] }>("/redirects"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["redirects"] });

  const save = useMutation({
    meta: { success: "Saved" },
    mutationFn: () => api("/redirects", { body: { from, to, permanent }, method: "PUT" }),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      setFrom("");
      setTo("");
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const remove = useMutation({
    meta: { success: "Deleted" },
    mutationFn: (id: number) => api(`/redirects/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const columns: Column<Redirect>[] = [
    { key: "from", header: "From", className: "font-mono text-sm", cell: (r) => r.from },
    { key: "to", header: "To", className: "font-mono text-sm", cell: (r) => r.to },
    {
      key: "type",
      header: "Type",
      cell: (r) => <Badge variant={r.permanent ? "default" : "secondary"}>{r.permanent ? "301" : "302"}</Badge>,
    },
    {
      key: "actions",
      headClassName: "w-12",
      className: "text-right",
      cell: (redirect) => (
        <RowActions
          actions={[
            {
              label: "Delete",
              icon: Trash2,
              variant: "destructive",
              onSelect: () =>
                confirmDialog({ description: `Delete redirect ${redirect.from}?` }, () => remove.mutate(redirect.id)),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Redirects"
        description="Send old URLs to new ones. Existing redirect sources are updated in place."
        action={
          <Button
            onClick={() => {
              setFrom("");
              setTo("");
              setError(null);
              setDialogOpen(true);
            }}
          >
            <Plus />
            New redirect
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyIcon={Redo}
        emptyTitle="No redirects"
        emptyHint="Send old URLs to new ones."
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="New redirect"
        onSubmit={() => save.mutate()}
        pending={save.isPending}
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Field label="From path" required>
          <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="/old-page" />
        </Field>
        <Field label="To path" required>
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="/new-page" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={permanent} onCheckedChange={(v) => setPermanent(v === true)} />
          Permanent (301)
        </label>
      </FormDialog>
    </div>
  );
}
