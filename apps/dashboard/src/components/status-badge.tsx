import { cn } from "@/lib/utils";

// One status vocabulary for the whole dashboard: plain labels instead of raw
// codes ("IN_PROGRESS"), and a small set of tones mapped onto tokens.
type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  info: "bg-blue-50 text-blue-700 ring-blue-600/15 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-400/20",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20",
  warning: "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20",
  danger: "bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20",
};

const DOT_CLASSES: Record<Tone, string> = {
  neutral: "bg-muted-foreground/60",
  info: "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

type StatusDef = { label: string; tone: Tone };

const STATUSES = {
  trip: {
    DRAFT: { label: "Draft (hidden from public)", tone: "neutral" },
    PUBLISHED: { label: "Published on your website", tone: "success" },
  },
  content: {
    draft: { label: "Draft (hidden from public)", tone: "neutral" },
    published: { label: "Published on your website", tone: "success" },
  },
  inquiry: {
    NEW: { label: "New, not answered yet", tone: "info" },
    IN_PROGRESS: { label: "Being handled", tone: "warning" },
    RESOLVED: { label: "Resolved", tone: "success" },
    CLOSED: { label: "Closed, no action needed", tone: "neutral" },
  },
  booking: {
    PENDING: { label: "Waiting for your confirmation", tone: "warning" },
    CONFIRMED: { label: "Confirmed", tone: "info" },
    COMPLETED: { label: "Trip completed", tone: "success" },
    CANCELLED: { label: "Cancelled", tone: "neutral" },
  },
  departure: {
    OPEN: { label: "Seats available", tone: "success" },
    FULL: { label: "Fully booked", tone: "warning" },
    DELAYED: { label: "Delayed", tone: "danger" },
  },
  ticket: {
    OPEN: { label: "Open, waiting for Wepilo", tone: "info" },
    IN_PROGRESS: { label: "Wepilo is working on it", tone: "warning" },
    RESOLVED: { label: "Resolved", tone: "success" },
    CLOSED: { label: "Closed", tone: "neutral" },
  },
  priority: {
    LOW: { label: "Low priority", tone: "neutral" },
    MEDIUM: { label: "Medium priority", tone: "info" },
    HIGH: { label: "High priority", tone: "warning" },
    URGENT: { label: "Urgent, blocking my business", tone: "danger" },
  },
  account: {
    active: { label: "Active", tone: "success" },
    disabled: { label: "Login turned off", tone: "neutral" },
    unsubscribed: { label: "Unsubscribed from emails", tone: "neutral" },
  },
  subscription: {
    ACTIVE: { label: "Active", tone: "success" },
    TRIALING: { label: "Free trial", tone: "info" },
    PAST_DUE: { label: "Payment overdue", tone: "warning" },
    CANCELED: { label: "Cancelled", tone: "neutral" },
    EXPIRED: { label: "Expired", tone: "danger" },
  },
  workspace: {
    ACTIVE: { label: "Active, paid", tone: "success" },
    TRIAL: { label: "Free trial", tone: "info" },
    PAST_DUE: { label: "Payment overdue", tone: "warning" },
    UNPAID: { label: "Unpaid, no access", tone: "neutral" },
    EXPIRED: { label: "Expired", tone: "neutral" },
    SUSPENDED: { label: "Suspended by Wepilo", tone: "danger" },
  },
} satisfies Record<string, Record<string, StatusDef>>;

export type StatusKind = keyof typeof STATUSES;

/** "IN_PROGRESS" → "In progress", for codes with no entry. */
function humanize(code: string) {
  const words = code.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function statusInfo(kind: StatusKind, code: string | null | undefined): StatusDef {
  const value = code ?? "";
  const map = STATUSES[kind] as Record<string, StatusDef>;
  return map[value] ?? map[value.toUpperCase()] ?? map[value.toLowerCase()] ?? { label: humanize(value) || "Not set", tone: "neutral" };
}

/** Status codes for a kind, in display order, for filters and selects. */
export function statusOptions(kind: StatusKind) {
  return Object.entries(STATUSES[kind] as Record<string, StatusDef>).map(([value, def]) => ({
    value,
    label: def.label,
  }));
}

export function StatusBadge({
  kind,
  status,
  className,
}: {
  kind: StatusKind;
  status: string | null | undefined;
  className?: string;
}) {
  const { label, tone } = statusInfo(kind, status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", DOT_CLASSES[tone])} />
      {label}
    </span>
  );
}
