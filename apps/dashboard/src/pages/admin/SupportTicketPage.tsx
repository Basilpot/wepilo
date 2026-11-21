import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Paperclip, Send } from "@/components/icons";
import { api, toastApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/form";

type Reply = {
  id: number;
  authorName: string | null;
  message: string;
  createdAt: string;
  staff: { id: number; name: string; role: string } | null;
};

type Ticket = {
  id: number;
  subject: string;
  category: string;
  message: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  creatorName: string | null;
  callbackNumber: string | null;
  createdAt: string;
  tenant: { id: number; companyName: string | null; slug: string; email: string; plan: string } | null;
  creator: { id: number; name: string; email: string; role: string } | null;
  replies: Reply[];
  attachments: Array<{ id: number; filename: string; mimeType: string; size: number; uploadedByName: string | null }>;
};

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

/** One request, and the Wepilo team's answer to it. */
export function SupportTicketPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["platform", "support", id],
    queryFn: () => api<{ ticket: Ticket }>(`/platform/support/${id}`),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["platform", "support"] });

  const send = useMutation({
    meta: { success: "Your reply was sent, and the agency was emailed." },
    mutationFn: () => api(`/platform/support/${id}/replies`, { body: { message: reply } }),
    onSuccess: () => {
      setReply("");
      invalidate();
    },
    onError: (err) => toastApiError(err),
  });

  const setStatus = useMutation({
    meta: { success: "The status was updated." },
    mutationFn: (status: string) => api(`/platform/support/${id}/status`, { body: { status }, method: "PATCH" }),
    onSuccess: invalidate,
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="h-48 w-full animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  const ticket = data.ticket;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={ticket.subject}
        description={`${ticket.category} · ${ticket.tenant?.companyName ?? ticket.tenant?.slug ?? "Unknown workspace"} · ${formatDate(ticket.createdAt)}`}
        action={
          <Button variant="outline" asChild>
            <Link to="/admin/support">
              <ArrowLeft />
              Back
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge kind="ticket" status={ticket.status} />
        <StatusBadge kind="priority" status={ticket.priority} />
        {ticket.tenant && (
          <Link to={`/admin/workspaces/${ticket.tenant.id}`} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-ink">
            {ticket.tenant.companyName ?? ticket.tenant.slug}
          </Link>
        )}
        {ticket.creator?.email && <span className="text-sm text-muted-foreground">{ticket.creator.email}</span>}
        {ticket.callbackNumber && <span className="text-sm text-muted-foreground">Callback: {ticket.callbackNumber}</span>}
        <Select value={ticket.status} onValueChange={(status) => setStatus.mutate(status)}>
          <SelectTrigger size="sm" className="ml-auto w-40" aria-label="Change the status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "IN_PROGRESS" ? "In progress" : s[0] + s.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-sm">{ticket.creatorName ?? ticket.creator?.name ?? "The agency"}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{ticket.message}</p>
        </CardContent>
      </Card>

      {ticket.replies.map((item) => (
        <Card key={item.id} className="mb-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {item.authorName ?? "Wepilo"}
              {item.staff ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground">{item.staff.role.toLowerCase()}</span>
              ) : (
                <span className="ml-2 text-xs font-normal text-muted-foreground">Wepilo team</span>
              )}
              <span className="ml-2 text-xs font-normal text-muted-foreground">{formatDate(item.createdAt)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{item.message}</p>
          </CardContent>
        </Card>
      ))}

      {ticket.attachments.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-lg border">
              {ticket.attachments.map((file) => (
                <li key={file.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                  <a
                    href={`/api/v1/platform/support/${ticket.id}/attachments/${file.id}`}
                    className="min-w-0 flex-1 truncate font-medium hover:underline"
                    download
                  >
                    {file.filename}
                  </a>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {file.uploadedByName ? `${file.uploadedByName} · ` : ""}
                    {Math.max(1, Math.round(file.size / 1024))} KB
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-3 pt-6">
          <Field label="Reply" hint="The agency gets this by email as well as in their dashboard.">
            <Textarea rows={5} value={reply} onChange={(e) => setReply(e.target.value)} />
          </Field>
          <Button onClick={() => send.mutate()} disabled={send.isPending || !reply.trim()}>
            <Send />
            {send.isPending ? "Sending…" : "Send reply"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
