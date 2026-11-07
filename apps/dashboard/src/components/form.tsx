import * as React from "react";
import { Loader2, PackageOpen } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { InstructionTooltip } from "@/components/atoms";
import { cn } from "@/lib/utils";
import { clearFieldError, useFieldError } from "@/lib/field-errors";
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = "Save",
  pending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  onSubmit?: () => void;
  submitLabel?: string;
  pending?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader className="space-y-2 px-6 pt-6 pb-4 pr-14">
          <SheetTitle className="text-xl font-semibold tracking-tight">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit?.();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
            {children}
          </div>
          <SheetFooter className="flex-row gap-3 border-t bg-muted/50 px-6 py-4">
            <Button type="button" variant="secondary" size="lg" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" size="lg" disabled={pending} className="flex-1">
              {pending && <Loader2 className="animate-spin" />}
              {pending ? "Saving…" : submitLabel}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** "Meeting point" → "meetingPoint": the field name the server most likely uses for it. */
const keyFromLabel = (label: string) =>
  label
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join("");

export function Field({
  label,
  htmlFor,
  error,
  hint,
  tooltip,
  children,
  required,
  className,
  name,
}: {
  label: string;
  htmlFor?: string;
  /** Overrides the server's message for this field. */
  error?: string;
  hint?: string;
  tooltip?: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
  /** The field's name in the request, when it differs from the label ("Short bio" is `bio`). Used to place the server's validation message. */
  name?: string;
}) {
  const key = name ?? keyFromLabel(label);
  const serverError = useFieldError(key);
  const message = error ?? serverError;
  const ref = React.useRef<HTMLDivElement>(null);

  // Bring a field with a problem into view, so nobody has to hunt for what went wrong.
  React.useEffect(() => {
    if (serverError) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [serverError]);

  return (
    <div
      ref={ref}
      data-invalid={message ? "true" : undefined}
      // Typing in the field dismisses its message.
      onInput={() => serverError && clearFieldError(key)}
      onChange={() => serverError && clearFieldError(key)}
      className={cn(
        "space-y-2 data-[invalid=true]:[&_input]:border-destructive data-[invalid=true]:[&_textarea]:border-destructive data-[invalid=true]:[&_[role=combobox]]:border-destructive",
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        <label htmlFor={htmlFor} className="text-sm font-semibold leading-none">
          {label}
          {required && <span className="text-destructive"> *</span>}
        </label>
        {tooltip && <InstructionTooltip instruction={tooltip} />}
      </div>
      {children}
      {hint && !message && <p className="text-[13px] leading-relaxed text-muted-foreground">{hint}</p>}
      {message && (
        <p role="alert" className="text-[13px] leading-relaxed text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon: Icon = PackageOpen,
  action,
  className,
}: {
  title: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed px-6 py-10 text-center", className)}>
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
