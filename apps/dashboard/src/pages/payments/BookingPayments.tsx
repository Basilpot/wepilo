import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "@/components/icons";
import { api, toastApiError, type Paginated } from "@/lib/api";
import { moneyMinor } from "@/lib/format";
import { confirmDialog } from "@/components/confirm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type PaymentRow = {
  id: number;
  provider: "STRIPE" | "BANK_TRANSFER" | "CASH" | "OTHER";
  kind: "DEPOSIT" | "BALANCE" | "FULL";
  amountMinor: number;
  currency: string;
  status: "PENDING" | "PAID" | "REVIEW" | "FAILED" | "EXPIRED" | "REFUNDED";
  note: string | null;
  paidAt: string | null;
  createdAt: string;
};

const METHOD: Record<PaymentRow["provider"], string> = {
  STRIPE: "Card",
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  OTHER: "Other",
};

const STATUS: Record<PaymentRow["status"], { label: string; className: string }> = {
  PAID: { label: "Received", className: "bg-muted text-foreground" },
  PENDING: { label: "Waiting", className: "bg-muted text-foreground" },
  REVIEW: { label: "Needs review", className: "bg-destructive/10 text-destructive" },
  FAILED: { label: "Failed", className: "bg-muted text-muted-foreground" },
  EXPIRED: { label: "Not paid", className: "bg-muted text-muted-foreground" },
  REFUNDED: { label: "Refunded", className: "bg-muted text-muted-foreground" },
};

export function paymentState(totalPrice: number, paidMinor: number, currency: string) {
  const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const totalMinor = Math.round(totalPrice * 10 ** digits);
  return paidMinor <= 0 ? "UNPAID" : paidMinor >= totalMinor ? "PAID" : "PARTIAL";
}

export function PaymentBadge({ totalPrice, paidMinor, currency }: { totalPrice: number; paidMinor: number; currency: string }) {
  const state = paymentState(totalPrice, paidMinor, currency);
  return (
    <Badge
      variant="secondary"
      className={cn(
        "font-normal",
        state === "PAID" && "bg-muted text-foreground",
        state === "PARTIAL" && "bg-muted text-foreground",
      )}
    >
      {state === "PAID" ? "Paid" : state === "PARTIAL" ? "Part paid" : "Unpaid"}
    </Badge>
  );
}

export function BookingPayments({
  bookingId,
  totalPrice,
  currency,
  status,
}: {
  bookingId: number;
  totalPrice: number;
  currency: string;
  status: string;
}) {
  const queryClient = useQueryClient();
  const key = ["payments", bookingId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api<Paginated<PaymentRow>>("/payments", { query: { bookingId, limit: 50 } }),
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: ["bookings"] });
  };

  const rows = data?.data ?? [];
  const paidMinor = rows.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amountMinor, 0);
  const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const dueMinor = Math.max(0, Math.round(totalPrice * 10 ** digits) - paidMinor);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"BANK_TRANSFER" | "CASH" | "OTHER">("BANK_TRANSFER");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  const record = useMutation({
    meta: { success: "Payment recorded." },
    mutationFn: () => api("/payments/manual", { body: { bookingId, amount: Number(amount), provider: method, note: note.trim() || undefined } }),
    onSuccess: () => {
      setAmount("");
      setNote("");
      setAdding(false);
      refresh();
    },
    onError: (err) => toastApiError(err),
  });
  const markPaid = useMutation({
    meta: { success: "Marked as received." },
    mutationFn: (id: number) => api(`/payments/${id}/mark-paid`, { method: "PATCH" }),
    onSuccess: refresh,
    onError: (err) => toastApiError(err),
  });
  const refund = useMutation({
    meta: { success: "Payment refunded." },
    mutationFn: (id: number) => api(`/payments/${id}/refund`, { body: {} }),
    onSuccess: refresh,
    onError: (err) => toastApiError(err),
  });

  const canRecord = status !== "CANCELLED" && dueMinor > 0;

  return (
    <section className="space-y-3 border-t pt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Payments</h3>
        <PaymentBadge totalPrice={totalPrice} paidMinor={paidMinor} currency={currency} />
      </div>
      <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Received</dt>
        <dd className="tabular-nums">{moneyMinor(paidMinor, currency)}</dd>
        <dt className="text-muted-foreground">Still due</dt>
        <dd className="tabular-nums">{moneyMinor(dueMinor, currency)}</dd>
      </dl>

      {isLoading ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payments yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((p) => (
            <li key={p.id} className="space-y-1.5 px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium tabular-nums">{moneyMinor(p.amountMinor, p.currency)}</span>
                <Badge variant="secondary" className={cn("font-normal", STATUS[p.status].className)}>
                  {STATUS[p.status].label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {METHOD[p.provider]} · {p.kind === "DEPOSIT" ? "Deposit" : p.kind === "BALANCE" ? "Balance" : "Full amount"} ·{" "}
                {new Date(p.paidAt ?? p.createdAt).toLocaleDateString()}
              </p>
              {p.note ? <p className="text-xs text-muted-foreground">{p.note}</p> : null}
              {(p.status === "PENDING" && p.provider !== "STRIPE") || p.status === "REVIEW" ? (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" disabled={markPaid.isPending} onClick={() => markPaid.mutate(p.id)}>
                    Mark as received
                  </Button>
                  {p.status === "REVIEW" && p.provider === "STRIPE" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() =>
                        confirmDialog(
                          { title: "Refund this payment?", description: "The money goes back to the traveller's card. This can't be undone.", confirmLabel: "Refund", cancelLabel: "Keep" },
                          () => refund.mutate(p.id),
                        )
                      }
                    >
                      Refund
                    </Button>
                  ) : null}
                </div>
              ) : p.status === "PAID" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    confirmDialog(
                      {
                        title: "Refund this payment?",
                        description:
                          p.provider === "STRIPE"
                            ? "The money goes back to the traveller's card. This can't be undone."
                            : "This only marks it as refunded here. Hand the money back to the traveller yourself.",
                        confirmLabel: "Refund",
                        cancelLabel: "Keep",
                      },
                      () => refund.mutate(p.id),
                    )
                  }
                >
                  Refund
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canRecord ? (
        adding ? (
          <form
            className="space-y-3 rounded-lg border bg-muted/30 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              record.mutate();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="pay-amount">
                  Amount ({currency})
                </label>
                <Input id="pay-amount" type="number" min="0.01" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={(dueMinor / 10 ** digits).toFixed(digits)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Method</label>
                <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK_TRANSFER">Bank transfer</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note, for example the transfer reference (optional)" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={record.isPending || !Number(amount)}>
                {record.isPending && <Loader2 className="animate-spin" />}
                Record payment
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            Record a payment
          </Button>
        )
      ) : null}
    </section>
  );
}
