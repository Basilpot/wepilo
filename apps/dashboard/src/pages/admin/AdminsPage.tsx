import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, UserCheck, UserX } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { Field, FormDialog } from "@/components/form";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlatformAdmin } from "./admin-api";

export function AdminsPage({ me }: { me: PlatformAdmin }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["platform", "admins"],
    queryFn: () => api<{ admins: PlatformAdmin[] }>("/platform/admins"),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["platform", "admins"] });

  const create = useMutation({
    meta: { success: "Admin added" },
    mutationFn: () => api("/platform/admins", { body: form }),
    onSuccess: () => {
      setOpen(false);
      setForm({ name: "", email: "", password: "" });
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Something went wrong"),
  });
  const toggle = useMutation({
    meta: { success: "Updated" },
    mutationFn: (a: PlatformAdmin) => api(`/platform/admins/${a.id}`, { method: "PATCH", body: { isActive: !a.isActive } }),
    onSuccess: invalidate,
  });

  const columns: Column<PlatformAdmin>[] = [
    {
      key: "name",
      header: "Admin",
      cell: (a) => (
        <div>
          <p className="font-medium">
            {a.name}
            {a.id === me.id && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
          </p>
          <p className="text-xs text-muted-foreground">{a.email}</p>
        </div>
      ),
    },
    { key: "status", header: "Status", cell: (a) => <StatusBadge kind="account" status={a.isActive ? "active" : "disabled"} /> },
    {
      key: "last",
      header: "Last sign-in",
      className: "text-muted-foreground",
      cell: (a) => (a.lastLoginAt ? formatDate(a.lastLoginAt) : "Never"),
    },
    {
      key: "actions",
      headClassName: "w-12",
      className: "text-right",
      cell: (a) =>
        a.id === me.id ? null : (
          <RowActions
            actions={[
              {
                label: a.isActive ? "Deactivate" : "Reactivate",
                icon: a.isActive ? UserX : UserCheck,
                onSelect: () => toggle.mutate(a),
              },
            ]}
          />
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Admins"
        description="People on the Wepilo team who can create and manage workspaces."
        action={
          <Button
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
          >
            <Plus />
            Add admin
          </Button>
        }
      />
      <DataTable columns={columns} rows={data?.admins ?? []} getRowId={(a) => a.id} isLoading={isLoading} />

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Add admin"
        description="They get full access to every workspace. Share the password with them securely."
        submitLabel="Add admin"
        pending={create.isPending}
        onSubmit={() => {
          setError(null);
          create.mutate();
        }}
      >
        <Field label="Name" htmlFor="a-name" required>
          <Input id="a-name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Email" htmlFor="a-email" required>
          <Input id="a-email" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </Field>
        <Field label="Password" htmlFor="a-password" required hint="At least 12 characters.">
          <Input
            id="a-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
        </Field>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </FormDialog>
    </div>
  );
}
