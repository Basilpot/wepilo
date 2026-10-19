import { Info, TriangleAlert, CircleAlert, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function LabelDescription({ text, className }: { text: string; className?: string }) {
  return <p className={cn("text-xs text-muted-foreground", className)}>{text}</p>;
}

export function InstructionTooltip({ instruction }: { instruction: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="More information"
            className="inline-flex text-muted-foreground transition-colors hover:text-foreground"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">{instruction}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const INFO_VARIANTS = {
  info: { icon: Info, cls: "border-border bg-muted/40 text-muted-foreground" },
  warning: { icon: TriangleAlert, cls: "border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200" },
  error: { icon: CircleAlert, cls: "border-destructive/30 bg-destructive/10 text-destructive" },
  success: { icon: CheckCircle2, cls: "border-emerald-300/60 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200" },
};

export function InfoCard({
  info,
  title,
  type = "info",
  className,
}: {
  info: string;
  title?: string;
  type?: keyof typeof INFO_VARIANTS;
  className?: string;
}) {
  const { icon: Icon, cls } = INFO_VARIANTS[type];
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-relaxed", cls, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {title && <p className="mb-0.5 font-medium">{title}</p>}
        <p>{info}</p>
      </div>
    </div>
  );
}

export function ListBox({ list }: { list: string[] }) {
  return (
    <ul className="space-y-1 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
      {list.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="text-foreground/40">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
