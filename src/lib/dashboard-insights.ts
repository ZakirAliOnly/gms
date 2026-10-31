import type { PrismaClient } from "@/generated/prisma/client";
import { startOfDaysFromNow, startOfTomorrow } from "./dates";

export type RevenuePoint = { date: string; membership: number; retail: number; expenses: number };
export type RecentMember = {
  id: string;
  name: string;
  barcode: string;
  package: string;
  price: string;
  nextRenewal: string | null;
  active: boolean;
  status: string;
};
const day = (date: Date) => new Date(date.getTime() + 5 * 3600000).toISOString().slice(0, 10);

export async function dashboardInsights(db: PrismaClient, tenantId?: string, now = new Date()) {
  const dates = { gte: startOfDaysFromNow(-59, now), lt: startOfTomorrow(now) };
  const [renewals, sales, expenses, members] = await Promise.all([
    db.renewalPayment.findMany({
      where: { tenantId, recordedAt: dates },
      select: { amount: true, recordedAt: true },
    }),
    db.retailInvoice.findMany({
      where: { tenantId, soldAt: dates },
      select: { total: true, soldAt: true },
    }),
    db.expense.findMany({
      where: { tenantId, spentAt: dates },
      select: { amount: true, spentAt: true },
    }),
    db.member.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
      select: {
        id: true,
        name: true,
        barcode: true,
        membership: {
          select: {
            status: true,
            nextRenewalDate: true,
            package: { select: { name: true, price: true } },
          },
        },
      },
    }),
  ]);
  const points = new Map<string, RevenuePoint>();
  for (let i = -59; i <= 0; i++) {
    const date = day(startOfDaysFromNow(i, now));
    points.set(date, { date, membership: 0, retail: 0, expenses: 0 });
  }
  for (const row of renewals) {
    const point = points.get(day(row.recordedAt));
    if (point) point.membership += Number(row.amount);
  }
  for (const row of sales) {
    const point = points.get(day(row.soldAt));
    if (point) point.retail += Number(row.total);
  }
  for (const row of expenses) {
    const point = points.get(day(row.spentAt));
    if (point) point.expenses += Number(row.amount);
  }
  return {
    series: [...points.values()],
    recentMembers: members.map((member) => ({
      id: member.id,
      name: member.name,
      barcode: member.barcode,
      package: member.membership?.package.name ?? "No membership",
      price: member.membership?.package.price.toString() ?? "0",
      nextRenewal: member.membership?.nextRenewalDate.toISOString() ?? null,
      status: !member.membership
        ? "No plan"
        : member.membership.status === "EXPIRED"
          ? "Expired"
          : member.membership.status === "CANCELLED"
            ? "Cancelled"
            : day(member.membership.nextRenewalDate) < day(now)
              ? "Overdue"
              : "Active",
      active:
        !!member.membership &&
        ["ACTIVE", "DUE"].includes(member.membership.status) &&
        day(member.membership.nextRenewalDate) >= day(now),
    })),
  };
}
