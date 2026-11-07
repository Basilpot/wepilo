import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Paperclip, Send, Trash2 } from "@/components/icons";
import { api, toastApiError, uploadFile } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/PageHeader";
import { Field } from "@/components/form";
import { useErrorMessage } from "@/pages/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Reply = {
  id: number;
  authorName: string;
  message: string;
  createdAt: string | number;
  staff: { id: number; name: string; role: string } | null;
};

type Ticket = {
  id: number;
  category: string;
  subject: string;
  message: string;
  callbackNumber: string | null;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  creatorName: string | null;
  createdAt: string | number;
  replies: Reply[];
};

type Attachment = { id: number; filename: string; mimeType: string; size: number; uploadedByName: string | null; createdAt: string | number };

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function Attachments({ ticketId }: { ticketId: number }) {
  const queryClient = useQueryClient();
  const key = ["support-attachments", ticketId];
  const fileRef = useRef<HTMLInputElement>(null);
  const { data } = useQuery({ queryKey: key, queryFn: () => api<{ data: Attachment[] }>(`/support/${ticketId}/attachments`) });
  const upload = useMutation({
    meta: { success: "File attached." },
    mutationFn: (file: File) => uploadFile(`/support/${ticketId}/attachments`, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: (err) => toastApiError(err),
  });
  const remove = useMutation({
    meta: { success: "Attachment removed." },
    mutationFn: (id: number) => api(`/support/${ticketId}/attachments/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: (err) => toastApiError(err),
  });
  const files = data?.data ?? [];
  return (
    <Card className="mb-4">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm">Attachments</CardTitle>
        <div>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept="image/*,application/pdf,text/plain"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={upload.isPending || files.length >= 10} onClick={() => fileRef.current?.click()}>
            <Paperclip />
            {upload.isPending ? "Uploading…" : "Attach a file"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">Screenshots, PDFs or text files help us fix things faster. Up to 5 MB each.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <a href={`/api/v1/support/${ticketId}/attachments/${f.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline" download>
                  {f.filename}
                </a>
                <span className="shrink-0 text-xs text-muted-foreground">{kb(f.size)}</span>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${f.filename}`} className="text-muted-foreground hover:text-destructive" onClick={() => remove.mutate(f.id)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function SupportTicketPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const errorMessage = useErrorMessage();

  const { data, isLoading } = useQuery({
    queryKey: ["support-ticket", id],
    queryFn: () => api<{ ticket: Ticket }>(`/support/${id}`),
  });

  const addReply = useMutation({
    meta: { success: "Your reply was sent to the Wepilo team." },
    mutationFn: () => api(`/support/${id}/replies`, { body: { message: reply } }),
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["support-ticket", id] });
    },
  });

  const setStatus = useMutation({
    meta: { success: "The request status was updated." },
    mutationFn: (status: string) => api(`/support/${id}/status`, { body: { status }, method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["support-ticket", id] }),
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const ticket = data.ticket;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={ticket.subject}
        description={`Topic: ${ticket.category} · Sent on ${new Date(ticket.createdAt).toLocaleString()}`}
        action={
          <Button variant="outline" onClick={() => navigate("/support")}>
            <ArrowLeft />
            Back
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge kind="ticket" status={ticket.status} />
        <StatusBadge kind="priority" status={ticket.priority} />
        {ticket.callbackNumber && <span className="text-sm text-muted-foreground">Callback: {ticket.callbackNumber}</span>}
        <Select value={ticket.status} onValueChange={(status) => setStatus.mutate(status)}>
          <SelectTrigger className="ml-auto h-8 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="IN_PROGRESS">In progress</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-sm">{ticket.creatorName ?? "You"}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{ticket.message}</p>
        </CardContent>
      </Card>

      {ticket.replies.map((item) => (
        <Card key={item.id} className="mb-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {item.authorName}
              {item.staff && (
                <Badge variant="secondary" className="ml-2">
                  {item.staff.role}
                </Badge>
              )}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {new Date(item.createdAt).toLocaleString()}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{item.message}</p>
          </CardContent>
        </Card>
      ))}

      <Attachments ticketId={ticket.id} />

      <Card>
        <CardContent className="space-y-3 pt-6">
          <Field label="Reply">
            <Textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} />
          </Field>
          <Button onClick={() => addReply.mutate()} disabled={addReply.isPending || !reply.trim()}>
            <Send />
            {addReply.isPending ? "Sending…" : "Send reply"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
