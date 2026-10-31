import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { startOfToday, startOfDaysFromNow } from "./dates";

/** Count overlapping tabs in one scoped scan rather than four round trips. */
export async function membershipCounts(
  db: Pick<PrismaClient, "$queryRaw">,
  tenantId: string,
  now = new Date()
) {
  const today = startOfToday(now);
  const weekEnd = startOfDaysFromNow(7, now);
  const [counts] = await db.$queryRaw<
    { active: number; renewals: number; overdue: number; expired: number }[]
  >(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('ACTIVE', 'DUE') AND "nextRenewalDate" >= ${today})::int AS active,
      COUNT(*) FILTER (WHERE status IN ('ACTIVE', 'DUE') AND "nextRenewalDate" >= ${today} AND "nextRenewalDate" < ${weekEnd})::int AS renewals,
      COUNT(*) FILTER (WHERE status IN ('ACTIVE', 'DUE', 'EXPIRED') AND "nextRenewalDate" < ${today})::int AS overdue,
      COUNT(*) FILTER (WHERE status IN ('EXPIRED', 'CANCELLED'))::int AS expired
    FROM "Membership" WHERE "tenantId" = ${tenantId}
  `);
  return counts;
}
