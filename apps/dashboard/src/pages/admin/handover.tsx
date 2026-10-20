import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SetupLink } from "./admin-api";

/** The one-time link that lets the client set a password and take over the workspace. */
export function SetupLinkPanel({ link, ownerEmail }: { link: SetupLink; ownerEmail: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it by hand.");
    }
  };

  return (
    <div className="rounded-lg border border-emerald-600/20 bg-emerald-50/60 p-4 dark:border-emerald-400/20 dark:bg-emerald-500/5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-emerald-700 ring-1 ring-emerald-600/20 dark:text-emerald-300">
          <KeyRound className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Setup link for {ownerEmail}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {link.emailSent ? "Emailed to the client. " : "Not emailed. Send it to the client yourself. "}
            It works once and expires {formatDate(link.expiresAt)}. This is the only time it's shown.
          </p>
          <div className="mt-3 flex gap-2">
            <Input readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} className="bg-background font-mono text-xs" />
            <Button type="button" variant="outline" onClick={copy} className="shrink-0">
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
