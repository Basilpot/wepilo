import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "@/components/icons";
import { api, toastApiError } from "@/lib/api";
import { Field } from "@/components/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsSection } from "@/pages/settings/parts";

type Domain =
  | { domain: null }
  | { domain: string; verified: boolean; verifiedAt: string | null; record: { type: string; name: string; value: string } };

function Copyable({ value }: { value: string }) {
  return (
    <code
      className="block cursor-pointer break-all rounded-md border bg-muted/50 px-2.5 py-1.5 font-mono text-xs"
      title="Click to copy"
      onClick={() => navigator.clipboard.writeText(value).then(() => toast.success("Copied"), () => undefined)}
    >
      {value}
    </code>
  );
}

export function DomainTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["domain"], queryFn: () => api<Domain>("/tenant/domain") });
  const [domain, setDomain] = useState("");
  useEffect(() => {
    if (data?.domain) setDomain(data.domain);
  }, [data]);

  const set = (next: Domain) => queryClient.setQueryData(["domain"], next);
  const save = useMutation({
    mutationFn: () => api<Domain>("/tenant/domain", { method: "PUT", body: { domain } }),
    onSuccess: set,
    onError: (err) => toastApiError(err),
  });
  const verify = useMutation({
    mutationFn: () => api<Domain>("/tenant/domain/verify", { body: {} }),
    onSuccess: (next) => {
      set(next);
      toast.success("Domain verified.");
    },
    onError: (err) => toastApiError(err, "We couldn't check your domain."),
  });
  const remove = useMutation({
    meta: { success: "Domain removed." },
    mutationFn: () => api<Domain>("/tenant/domain", { method: "DELETE" }),
    onSuccess: (next) => {
      set(next);
      setDomain("");
    },
  });

  if (isLoading || !data) return <Skeleton className="h-48 w-full" />;
  const current = data.domain ? data : null;

  return (
    <SettingsSection
      title="Your website's domain"
      description="Tell Wepilo which domain your site runs on. Once it is verified, your site is recognised automatically, and payment returns to it are allowed."
    >
      <Field label="Domain" hint="For example www.youragency.com. No https:// needed.">
        <div className="flex gap-2">
          <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="www.youragency.com" />
          <Button type="button" disabled={save.isPending || !domain.trim() || domain.trim() === current?.domain} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="animate-spin" />}
            {current ? "Change" : "Add domain"}
          </Button>
        </div>
      </Field>

      {current ? (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              {current.domain}
              <Badge variant="secondary" className={current.verified ? "bg-muted font-normal text-foreground" : "font-normal"}>
                {current.verified ? "Verified" : "Not verified"}
              </Badge>
            </p>
            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
              Remove
            </Button>
          </div>
          {!current.verified ? (
            <>
              <p className="text-sm text-muted-foreground">
                At your domain provider (where you bought the domain), add this DNS record, then select Check now. It can take up to an hour to show up.
              </p>
              <dl className="grid grid-cols-[4rem_1fr] items-center gap-x-3 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Type</dt>
                <dd>{current.record.type}</dd>
                <dt className="text-muted-foreground">Name</dt>
                <dd>
                  <Copyable value={current.record.name} />
                </dd>
                <dt className="text-muted-foreground">Value</dt>
                <dd>
                  <Copyable value={current.record.value} />
                </dd>
              </dl>
              <Button type="button" disabled={verify.isPending} onClick={() => verify.mutate()}>
                {verify.isPending && <Loader2 className="animate-spin" />}
                Check now
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Requests from this domain (with or without www) are matched to your workspace. Your API key keeps working as well.
            </p>
          )}
        </div>
      ) : null}
    </SettingsSection>
  );
}
