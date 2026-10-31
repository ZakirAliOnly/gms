import type { Prisma } from "@/generated/prisma/client";
import { startOfToday, startOfDaysFromNow } from "./dates";

export const MEMBERSHIP_TABS = ["active", "renewals", "overdue", "expired"] as const;
export type MembershipTab = (typeof MEMBERSHIP_TABS)[number];

export function membershipFilter(
  tab: MembershipTab,
  tenantId?: string,
  now = new Date()
): Prisma.MembershipWhereInput {
  const today = startOfToday(now);
  if (tab === "active")
    return { tenantId, status: { in: ["ACTIVE", "DUE"] }, nextRenewalDate: { gte: today } };
  if (tab === "renewals")
    return {
      tenantId,
      status: { in: ["ACTIVE", "DUE"] },
      nextRenewalDate: { gte: today, lt: startOfDaysFromNow(7, now) },
    };
  if (tab === "overdue")
    return {
      tenantId,
      status: { in: ["ACTIVE", "DUE", "EXPIRED"] },
      nextRenewalDate: { lt: today },
    };
  return { tenantId, status: { in: ["EXPIRED", "CANCELLED"] } };
}
