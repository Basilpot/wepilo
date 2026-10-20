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
    meta: { success: "Ticket created" },
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
      header: "Subject",
      cell: (t) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{t.subject}</p>
          <p className="truncate text-xs text-muted-foreground">{t.category}</p>
        </div>
      ),
    },
    { key: "creator", header: "From", cell: (t) => t.creatorName ?? "You" },
    {
      key: "created",
      header: "Created",
      className: "whitespace-nowrap text-muted-foreground",
      cell: (t) => new Date(t.createdAt).toLocaleDateString(),
    },
    {
      key: "priority",
      header: "Priority",
      cell: (t) => <StatusBadge kind="priority" status={t.priority} />,
    },
    {
      key: "status",
      header: "Status",
      cell: (t) => <StatusBadge kind="ticket" status={t.status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Support"
        description="Tickets with the Wepilo team."
        action={
          <Button
            onClick={() => {
              setError(null);
              setDialogOpen(true);
            }}
          >
            <Plus />
            New ticket
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
        emptyTitle="No tickets"
        emptyHint="Open a ticket and the Wepilo team will follow up."
        toolbar={
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="IN_PROGRESS">In progress</SelectItem>
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
        title="New support ticket"
        onSubmit={() => create.mutate()}
        pending={create.isPending}
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Field label="Category" required>
          <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="billing">Billing</SelectItem>
              <SelectItem value="technical">Technical</SelectItem>
              <SelectItem value="feature">Feature request</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Subject" required>
          <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
        </Field>
        <Field label="Message" required>
          <Textarea rows={5} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Callback number">
            <Input
              value={form.callbackNumber}
              onChange={(e) => setForm((f) => ({ ...f, callbackNumber: e.target.value }))}
            />
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </FormDialog>
    </div>
  );
}
