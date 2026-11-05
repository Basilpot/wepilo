import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, LifeBuoy } from "lucide-react";
import { api, type Paginated } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/PageHeader";
import { Field, FormDialog } from "@/components/form";
import { DataTable, type Column } from "@/components/data-table";
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

type Ticket = {
  id: number;
  category: string;
  subject: string;
  message: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  creatorName: string | null;
  createdAt: string | number;
};

const statusVariant = (status: Ticket["status"]) =>
  status === "OPEN" ? "default" : status === "RESOLVED" || status === "CLOSED" ? "secondary" : "outline";

const priorityVariant = (priority: Ticket["priority"]) =>
  priority === "URGENT" || priority === "HIGH" ? "destructive" : "secondary";

type FormState = { category: string; subject: string; message: string; callbackNumber: string; priority: string };
const empty: FormState = { category: "general", subject: "", message: "", callbackNumber: "", priority: "MEDIUM" };

export function SupportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [status, setStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);
  const errorMessage = useErrorMessage();

  const { data, isLoading } = useQuery({
    queryKey: ["support", page, limit, status],
    queryFn: () =>
      api<Paginated<Ticket>>("/support", {
        query: { page, limit, status: status === "all" ? undefined : status },
      }),
  });

  const create = useMutation({
    meta: { success: "Your message was sent to the Wepilo team. We will reply here and by email." },
    mutationFn: () =>
      api("/support", {
        body: {
          category: form.category,
          subject: form.subject,
          message: form.message,
          callbackNumber: form.callbackNumber || undefined,
          priority: form.priority,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support"] });
      setDialogOpen(false);
      setForm(empty);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const columns: Column<Ticket>[] = [
    {
      key: "subject",
      header: "What your message is about",
      cell: (t) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{t.subject}</p>
          <p className="truncate text-xs text-muted-foreground">{t.category}</p>
        </div>
      ),
    },
    { key: "creator", header: "Sent by", cell: (t) => t.creatorName ?? "You" },
    {
      key: "created",
      header: "Date sent",
      className: "whitespace-nowrap text-muted-foreground",
      cell: (t) => new Date(t.createdAt).toLocaleDateString(),
    },
    {
      key: "priority",
      header: "How urgent",
      cell: (t) => <StatusBadge kind="priority" status={t.priority} />,
    },
    {
      key: "status",
      header: "Where it stands",
      cell: (t) => <StatusBadge kind="ticket" status={t.status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Contact Wepilo support"
        description="Ask the Wepilo team for help, report a problem, or suggest a feature. Each message becomes a support request that you can follow here, and we reply on the same page. Select a request to read the replies."
        action={
          <Button
            onClick={() => {
              setError(null);
              setDialogOpen(true);
            }}
          >
            <Plus />
            Send a new message to support
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(t) => t.id}
        isLoading={isLoading}
        onRowClick={(t) => navigate(`/support/${t.id}`)}
        emptyIcon={LifeBuoy}
        emptyTitle="You have not contacted support yet"
        emptyHint="If something is not working or you need help, select “Send a new message to support”. Describe what you were doing and what went wrong, and the Wepilo team will reply."
        toolbar={
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-56" aria-label="Show only requests in this state">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All requests</SelectItem>
              <SelectItem value="OPEN">Open, waiting for Wepilo</SelectItem>
              <SelectItem value="IN_PROGRESS">Wepilo is working on it</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>
        }
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
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Send a new message to support"
        description="The more detail you give, the faster we can help. Tell us what you were trying to do and what happened instead."
        submitLabel="Send to Wepilo support"
        onSubmit={() => create.mutate()}
        pending={create.isPending}
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Field label="What do you need help with?" required>
          <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">A general question</SelectItem>
              <SelectItem value="billing">My plan, payment or invoice</SelectItem>
              <SelectItem value="technical">Something is broken or not working</SelectItem>
              <SelectItem value="feature">An idea for a new feature</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Short summary" required hint="Example: I cannot publish my trip">
          <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
        </Field>
        <Field label="Describe the problem or question" required hint="Include the name of the page, what you clicked, and any error message you saw.">
          <Textarea rows={5} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone number for a call back (optional)" hint="Include the country code.">
            <Input
              value={form.callbackNumber}
              onChange={(e) => setForm((f) => ({ ...f, callbackNumber: e.target.value }))}
            />
          </Field>
          <Field label="How urgent is this?">
            <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low, whenever you can</SelectItem>
                <SelectItem value="MEDIUM">Medium, normal request</SelectItem>
                <SelectItem value="HIGH">High, affecting my work</SelectItem>
                <SelectItem value="URGENT">Urgent, my business is blocked</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </FormDialog>
    </div>
  );
}
