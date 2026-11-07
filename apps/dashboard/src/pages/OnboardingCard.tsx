import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown } from "@/components/icons";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Step = { key: string; title: string; hint: string; done: boolean; to: string };
type Onboarding = { steps: Step[]; completed: number; total: number };

const COLLAPSED = "wepilo-onboarding-collapsed";
/** Older versions let people dismiss the card. Anyone who did gets it back, folded away. */
const LEGACY_DISMISSED = "wepilo-onboarding-dismissed";

function startsCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED) === "1" || localStorage.getItem(LEGACY_DISMISSED) === "1";
  } catch {
    return false;
  }
}

/** Setup checklist for new workspaces. It can be folded away, but only disappears once every step is done. */
export function OnboardingCard() {
  const [open, setOpen] = useState(() => !startsCollapsed());
  const { data } = useQuery({ queryKey: ["onboarding"], queryFn: () => api<Onboarding>("/tenant/onboarding"), staleTime: 30_000 });
  if (!data || data.completed === data.total) return null;

  const toggle = (next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(COLLAPSED, next ? "0" : "1");
      localStorage.removeItem(LEGACY_DISMISSED);
    } catch {
      /* storage blocked: it just opens again next visit */
    }
  };

  const next = data.steps.find((s) => !s.done);
  return (
    <Collapsible open={open} onOpenChange={toggle} asChild>
      <section className="rounded-2xl border border-border/80 bg-card shadow-sm" aria-label="Setup checklist">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex w-full items-center gap-4 p-6 text-left" aria-label={open ? "Fold away the setup checklist" : "Show the setup checklist"}>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-tight">Get your site ready</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {data.completed} of {data.total} done{next ? `. Next: ${next.title.toLowerCase()}.` : "."}
              </p>
            </div>
            {/* The progress shows even while folded, so there is always a reason to come back to it. */}
            {!open && (
              <div className="hidden h-1.5 w-40 overflow-hidden rounded-full bg-muted sm:block" aria-hidden>
                <div className="h-full rounded-full bg-primary" style={{ width: `${(data.completed / data.total) * 100}%` }} />
              </div>
            )}
            <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-6 pb-6">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={data.total} aria-valuenow={data.completed}>
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(data.completed / data.total) * 100}%` }} />
            </div>
            <ul className="mt-4 grid gap-1 sm:grid-cols-2">
              {data.steps.map((s) => (
                <li key={s.key}>
                  <Link to={s.to} className={cn("flex items-start gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-accent", s.done && "text-muted-foreground")}>
                    <CheckCircle2 className={cn("mt-0.5 size-4 shrink-0", s.done ? "text-foreground" : "text-muted-foreground/40")} />
                    <span>
                      <span className={cn("block font-medium", s.done && "line-through decoration-muted-foreground/40")}>{s.title}</span>
                      {!s.done ? <span className="block text-xs text-muted-foreground">{s.hint}</span> : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
