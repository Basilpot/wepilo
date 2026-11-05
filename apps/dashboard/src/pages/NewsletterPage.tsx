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
    meta: { success: "Subscriber updated." },
    mutationFn: (id: number) => api(`/newsletter/${id}/toggle`, { method: "PATCH" }),
    onSuccess: invalidate,
  });

  const send = useMutation({
    meta: { success: "Your email was sent to your subscribers." },
    mutationFn: () => api<{ sent: number; total: number }>("/newsletter/send", { body: { subject, html } }),
    onSuccess: (result) => {
      setSent(`Your email was delivered to ${result.sent} of ${result.total} subscribers who are still subscribed.`);
      setSendOpen(false);
      setSubject("");
      setHtml("");
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const activeCount = data?.data.filter((s) => s.isActive).length;

  const columns: Column<Subscriber>[] = [
    { key: "email", header: "Subscriber’s email address", cell: (s) => <span className="font-medium">{s.email}</span> },
    {
      key: "status",
      header: "Receives your emails?",
      cell: (s) => (
        <StatusBadge kind="account" status={s.isActive ? "active" : "unsubscribed"} />
      ),
    },
    {
      key: "subscribed",
      header: "Date they signed up",
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
              label: subscriber.isActive ? "Stop sending emails to this person" : "Start sending emails to this person again",
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
        title="Newsletter subscribers"
        description={data ? `${data.pagination.total} ${data.pagination.total === 1 ? "person has" : "people have"} signed up for your newsletter on your website. Use “Write an email to all subscribers” to send them news, offers or new trips. You can also stop emailing anyone from the actions menu on their row.` : "People who signed up for your newsletter on your website. Send them news, offers or new trips."}
        action={
          <Button onClick={() => { setSent(null); setError(null); setSendOpen(true); }} disabled={!activeCount}>
            Write an email to all subscribers
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
        emptyTitle="Nobody has subscribed to your newsletter yet"
        emptyHint="People appear here after they enter their email in the newsletter sign-up form on your website. Make sure your website shows that form, for example in the footer."
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
        title="Write an email to all subscribers"
        description="This email is sent right away to everyone who is still subscribed. You cannot unsend it, so read it carefully, including the spelling, before you send."
        onSubmit={() => send.mutate()}
        pending={send.isPending}
        submitLabel="Send this email to all subscribers now"
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Field label="Email subject line" required hint="This is the first thing subscribers see in their inbox. Keep it short and specific.">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="Email message" required hint="Type your message. Plain text is fine, and it is placed in a simple, clean email layout automatically. Advanced users can paste HTML.">
          <Textarea rows={10} value={html} onChange={(e) => setHtml(e.target.value)} />
        </Field>
      </FormDialog>
    </div>
  );
}
