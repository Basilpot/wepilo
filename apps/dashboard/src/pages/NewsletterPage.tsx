import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailCheck, MailX, Mail } from "lucide-react";
import { api, type Paginated } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/PageHeader";
import { Field, FormDialog } from "@/components/form";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { useErrorMessage } from "@/pages/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Subscriber = {
  id: number;
  email: string;
  isActive: boolean;
  createdAt: string | number;
};

export function NewsletterPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sendOpen, setSendOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const errorMessage = useErrorMessage();

  const { data, isLoading } = useQuery({
    queryKey: ["newsletter", page, limit],
    queryFn: () => api<Paginated<Subscriber>>("/newsletter", { query: { page, limit } }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["newsletter"] });

  const toggle = useMutation({
    meta: { success: "Updated" },
    mutationFn: (id: number) => api(`/newsletter/${id}/toggle`, { method: "PATCH" }),
    onSuccess: invalidate,
  });

  const send = useMutation({
    meta: { success: "Sent" },
    mutationFn: () => api<{ sent: number; total: number }>("/newsletter/send", { body: { subject, html } }),
    onSuccess: (result) => {
      setSent(`Sent to ${result.sent} of ${result.total} active subscribers.`);
      setSendOpen(false);
      setSubject("");
      setHtml("");
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const activeCount = data?.data.filter((s) => s.isActive).length;

  const columns: Column<Subscriber>[] = [
    { key: "email", header: "Email", cell: (s) => <span className="font-medium">{s.email}</span> },
    {
      key: "status",
      header: "Status",
      cell: (s) => (
        <StatusBadge kind="account" status={s.isActive ? "active" : "unsubscribed"} />
      ),
    },
    {
      key: "subscribed",
      header: "Subscribed",
      className: "text-muted-foreground",
      cell: (s) => new Date(s.createdAt).toLocaleDateString(),
    },
    {
      key: "actions",
      headClassName: "w-12",
      className: "text-right",
      cell: (subscriber) => (
        <RowActions
          actions={[
            {
              label: subscriber.isActive ? "Unsubscribe" : "Reactivate",
              icon: subscriber.isActive ? MailX : MailCheck,
              onSelect: () => toggle.mutate(subscriber.id),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Newsletter"
        description={data ? `${data.pagination.total} subscribers` : "Manage subscribers and send broadcasts."}
        action={
          <Button onClick={() => { setSent(null); setError(null); setSendOpen(true); }} disabled={!activeCount}>
            Send broadcast
          </Button>
        }
      />

      {sent && (
        <p className="mb-4 rounded-xl border border-border bg-muted p-3 text-sm">{sent}</p>
      )}

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(s) => s.id}
        isLoading={isLoading}
        emptyIcon={Mail}
        emptyTitle="No subscribers yet"
        emptyHint="Subscribers come from your storefront signup form."
        pagination={
          data
            ? {
                page: data.pagination.page,
                totalPages: data.pagination.totalPages,
                total: data.pagination.total,
                limit,
                onPage: setPage,
                onLimit: (l) => { setLimit(l); setPage(1); },
              }
            : undefined
        }
      />

      <FormDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        title="Send broadcast"
        description={`Goes to ${activeCount ?? 0} active subscribers via Resend.`}
        onSubmit={() => send.mutate()}
        pending={send.isPending}
        submitLabel="Send"
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Field label="Subject" required>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="HTML body" required hint="Plain text is wrapped in a simple layout automatically.">
          <Textarea rows={10} value={html} onChange={(e) => setHtml(e.target.value)} />
        </Field>
      </FormDialog>
    </div>
  );
}
