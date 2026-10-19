import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send } from "lucide-react";
import { api } from "@/lib/api";
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
    meta: { success: "Reply sent" },
    mutationFn: () => api(`/support/${id}/replies`, { body: { message: reply } }),
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["support-ticket", id] });
    },
  });

  const setStatus = useMutation({
    meta: { success: "Status updated" },
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
        description={`${ticket.category} · opened ${new Date(ticket.createdAt).toLocaleString()}`}
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
