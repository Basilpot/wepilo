import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { api, type Paginated } from "@/lib/api";
import { Check, Copy, ExternalLink, Loader2, Trash2 } from "@/components/icons";
import { Field } from "@/components/form";
import { Combobox } from "@/components/combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";

type ReviewLink = { id: number; token: string; url: string; expiresAt: string; activity: { id: number; title: string | null } | null };

const DURATIONS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "6 months" },
  { value: "365", label: "1 year" },
];

/** Make a review link (and QR code) for one trip, and manage the links that are still live. */
export function CollectReviewsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [tripId, setTripId] = useState("");
  const [days, setDays] = useState("30");
  const [created, setCreated] = useState<ReviewLink | null>(null);
  const [view, setView] = useState<"link" | "qr">("link");
  const [copied, setCopied] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  const trips = useQuery({
    queryKey: ["trips", "for-review-links"],
    queryFn: () => api<Paginated<{ id: number; title: string | null }>>("/activities", { query: { limit: 100, status: "PUBLISHED" } }),
    enabled: open,
  });
  const links = useQuery({
    queryKey: ["review-links"],
    queryFn: () => api<{ data: ReviewLink[] }>("/review-links"),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () => api<{ link: ReviewLink }>("/review-links", { body: { activityId: tripId ? Number(tripId) : undefined, expiresInDays: Number(days) } }),
    onSuccess: ({ link }) => {
      setCreated(link);
      setView("link");
      void queryClient.invalidateQueries({ queryKey: ["review-links"] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: number) => api(`/review-links/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["review-links"] });
      setCreated((c) => c);
    },
  });

  useEffect(() => {
    if (!created) return setQr(null);
    let live = true;
    QRCode.toDataURL(created.url, { width: 640, margin: 2, errorCorrectionLevel: "M" }).then((url) => live && setQr(url));
    return () => {
      live = false;
    };
  }, [created]);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied((c) => (c === url ? null : c)), 1800);
    } catch {
      // clipboard blocked: the link is selectable in the box
    }
  };

  const reset = () => {
    setCreated(null);
    setTripId("");
  };

  return (
    <Sheet open={open} onOpenChange={(o) => (onOpenChange(o), !o && reset())}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="space-y-2 px-6 pt-6 pb-4 pr-14">
          <SheetTitle className="text-xl font-semibold tracking-tight">Collect reviews</SheetTitle>
          <SheetDescription>
            Make a link for one trip and share it by message or email, or print the QR code. Travellers write their review on a simple page, no account needed. Every review waits for your approval before it appears on your website.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-8 overflow-y-auto px-6 pb-6">
          {!created ? (
            <div className="space-y-5">
              <Field label="Trip" name="activityId" required hint="Only published trips are listed.">
                <Combobox
                  value={tripId}
                  setValue={setTripId}
                  placeholder="Select a trip"
                  notFoundPlaceholder="No published trips found."
                  options={(trips.data?.data ?? []).map((t) => ({ value: String(t.id), label: t.title ?? `Trip ${t.id}` }))}
                />
              </Field>
              <Field label="Link stays valid for" name="expiresInDays" hint="After this, the link stops working and nobody can add reviews with it. You can always make a new one.">
                <Select value={days} onValueChange={setDays}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Button size="lg" className="w-full" disabled={create.isPending} onClick={() => create.mutate()}>
                {create.isPending && <Loader2 className="animate-spin" />}
                Create review link
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold">{created.activity?.title}</p>
                <p className="text-[13px] text-muted-foreground">Valid until {formatDate(created.expiresAt)}</p>
              </div>
              <Tabs value={view} onValueChange={(v) => setView(v as "link" | "qr")}>
                <TabsList>
                  <TabsTrigger value="link">Link</TabsTrigger>
                  <TabsTrigger value="qr">QR code</TabsTrigger>
                </TabsList>
              </Tabs>
              {view === "link" ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input readOnly value={created.url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
                    <Button variant="outline" onClick={() => void copy(created.url)}>
                      {copied === created.url ? <Check /> : <Copy />}
                      {copied === created.url ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <a href={created.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink />
                      Open the review page
                    </a>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex aspect-square max-w-xs items-center justify-center rounded-xl border bg-white p-3">
                    {qr ? <img src={qr} alt="QR code for the review link" className="size-full" /> : <Loader2 className="animate-spin text-muted-foreground" />}
                  </div>
                  {qr && (
                    <Button asChild variant="outline">
                      <a href={qr} download={`review-${(created.activity?.title ?? "trip").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`}>
                        Download QR code
                      </a>
                    </Button>
                  )}
                </div>
              )}
              <Button variant="link" className="px-0" onClick={reset}>
                Make another link
              </Button>
            </div>
          )}

          {(links.data?.data.length ?? 0) > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Links that are still live</h3>
              <ul className="divide-y rounded-xl border">
                {links.data!.data.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.activity?.title ?? "Trip"}</p>
                      <p className="text-xs text-muted-foreground">Valid until {formatDate(l.expiresAt)}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void copy(l.url)}>
                      {copied === l.url ? "Copied" : "Copy link"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Stop this link working"
                      title="Stop this link working"
                      disabled={revoke.isPending}
                      onClick={() => {
                        revoke.mutate(l.id);
                        if (created?.id === l.id) reset();
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <SheetFooter className="border-t bg-muted/50 px-6 py-4">
          <Button variant="secondary" size="lg" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
