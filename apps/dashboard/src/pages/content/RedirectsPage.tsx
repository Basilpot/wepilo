import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Redo } from "@/components/icons";
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
    meta: { success: "Redirect saved. Visitors who open the old link will now be sent to the new one." },
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
    meta: { success: "Redirect deleted. The old link will no longer forward visitors." },
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
                confirmDialog({ title: `Delete the redirect from ${redirect.from}?`, description: "Anyone who opens the old link, including from Google results or bookmarks, will see a “page not found” error instead of being sent to the new page." }, () => remove.mutate(redirect.id)),
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
        description="When you rename or delete a page, the old link stops working and visitors see an error. A redirect automatically sends anyone who opens the old link to the new page instead, and keeps your Google ranking. If you add a redirect for an old link that already has one, the existing redirect is replaced."
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
        emptyHint="Add one whenever you change the web address of a page or trip, or remove a page that people still link to. Select “New redirect” to begin."
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="New redirect"
        description="Tell your website where to send visitors who open an old link."
        onSubmit={() => save.mutate()}
        pending={save.isPending}
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Field label="From path" required hint="Type only the part after your website address, starting with a slash. Example: /old-trek-name">
          <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="/old-trek-name" />
        </Field>
        <Field label="To path" required hint="Type only the part after your website address, starting with a slash. Example: /trips/everest-base-camp">
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="/trips/everest-base-camp" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={permanent} onCheckedChange={(v) => setPermanent(v === true)} />
          Permanent (301)
        </label>
      </FormDialog>
    </div>
  );
}
