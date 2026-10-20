import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Access, PlanKey } from "@/pages/billing/billing";

/** Mirrors apps/api/src/routes/platform.ts. */
export type PlatformAdmin = {
  id: number;
  email: string;
  name: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type WorkspaceSummary = {
  id: number;
  companyName: string | null;
  slug: string;
  email: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
  plan: PlanKey;
  planExpiresAt: string | null;
  billingMode: "SELF_SERVE" | "MANUAL";
  createdByAdminId: number | null;
  createdAt: string;
  access: Access;
  subscription: {
    status: string;
    plan: PlanKey;
    interval: "monthly" | "annual" | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    hasPaidSubscription: boolean;
  } | null;
};

export type WorkspaceDetail = {
  tenant: WorkspaceSummary & {
    phone: string | null;
    website: string | null;
    internalNotes: string | null;
    trialUsedAt: string | null;
  };
  owner: { id: number; name: string; email: string } | null;
  pendingSetupUntil: string | null;
  staff: Array<{ id: number; name: string; email: string; role: string; isActive: boolean; createdAt: string }>;
  usage: { trips: number; posts: number; bookings: number; staff: number };
  log: Array<{
    id: number;
    action: string;
    detail: Record<string, unknown> | null;
    createdAt: string;
    admin: { name: string; email: string } | null;
  }>;
};

export type SetupLink = { url: string; expiresAt: string; emailSent: boolean };

export function useAdminSession() {
  return useQuery({
    queryKey: ["platform", "me"],
    queryFn: async () => {
      try {
        return (await api<{ admin: PlatformAdmin }>("/platform/auth/me")).admin;
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });
}

/** Status code for the "workspace" badge: suspension wins over billing access. */
export function workspaceState(w: Pick<WorkspaceSummary, "status" | "access">) {
  return w.status === "SUSPENDED" ? "SUSPENDED" : w.access.state;
}

export const AUDIT_LABELS: Record<string, string> = {
  "workspace.created": "Created workspace",
  "workspace.updated": "Updated workspace",
  "workspace.setup_link": "New setup link",
  "workspace.opened_as_owner": "Opened as owner",
};

/** yyyy-mm-dd for <input type="date">, in local time. */
export function toDateInput(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** End of the chosen local day, so "until Mar 3" includes Mar 3. */
export function fromDateInput(value: string) {
  return value ? new Date(`${value}T23:59:59`).toISOString() : null;
}
