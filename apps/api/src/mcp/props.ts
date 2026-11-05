import type { StaffTokenPayload } from "@/lib/auth";

/** What an approved connection carries on every MCP request (encrypted at rest by the OAuth provider). */
export type ConnectionProps = {
  staffId: number;
  tenantId: number;
  role: StaffTokenPayload["role"];
  staffName: string;
  companyName: string;
};

/** OAuth user ids may not contain ":"; one id per staff login. */
export const grantUserId = (staffId: number) => `staff-${staffId}`;

export function isConnectionProps(value: unknown): value is ConnectionProps {
  const v = value as Partial<ConnectionProps> | null;
  return Boolean(v && typeof v.staffId === "number" && typeof v.tenantId === "number" && typeof v.role === "string");
}
