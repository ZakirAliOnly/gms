import { db } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { tenantDb } from "@/lib/tenant-db";
import { membershipFilter } from "@/lib/membership-filter";
import { dashboardInsights, type RevenuePoint, type RecentMember } from "@/lib/dashboard-insights";
import { startOfMonth, startOfNextMonth, startOfToday, startOfTomorrow } from "@/lib/dates";

export type DashboardStats = {
  activeMembers: number;
  renewalsDueThisWeek: number;
  renewalsOverdue: number;
  revenueToday: number;
  revenueThisMonth: number;
  membershipRevenueThisMonth: number;
  retailRevenueThisMonth: number;
  expensesThisMonth: number;
  lowStockCount: number;
  series: RevenuePoint[];
  recentMembers: RecentMember[];
};

function sum(value: { toString(): string } | null | undefined): number {
  return value ? Number(value.toString()) : 0;
}

/**
 * The dashboard's figures (FR-52).
 *
 * Every query is filtered by tenantId - under the shared-schema model that
 * filter is the isolation boundary, not an optimisation.
 *
 * Day and month boundaries come from Asia/Karachi, so "today" means the
 * tenant's day rather than the server's.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const { tenantId } = await tenantDb();
  return queryStats(tenantId);
}
export async function getAdminDashboardStats() {
  await requireRole("ADMIN");
  return queryStats();
}
async function queryStats(tenantId?: string): Promise<DashboardStats> {
  const now = new Date();
  const todayStart = startOfToday(now);
  const tomorrowStart = startOfTomorrow(now);
  const monthStart = startOfMonth(now);
  const nextMonthStart = startOfNextMonth(now);

  const [
    activeMembers,
    renewalsDueThisWeek,
    renewalsOverdue,
    renewalToday,
    retailToday,
    renewalMonth,
    retailMonth,
    expenseMonth,
    lowStock,
    insights,
  ] = await Promise.all([
    db.membership.count({
      where: membershipFilter("active", tenantId, now),
    }),

    // Due between today and 7 days out - not yet overdue.
    db.membership.count({
      where: membershipFilter("renewals", tenantId, now),
    }),

    db.membership.count({
      where: membershipFilter("overdue", tenantId, now),
    }),

    db.renewalPayment.aggregate({
      where: { tenantId, recordedAt: { gte: todayStart, lt: tomorrowStart } },
      _sum: { amount: true },
    }),

    db.retailInvoice.aggregate({
      where: { tenantId, soldAt: { gte: todayStart, lt: tomorrowStart } },
      _sum: { total: true },
    }),

    db.renewalPayment.aggregate({
      where: { tenantId, recordedAt: { gte: monthStart, lt: nextMonthStart } },
      _sum: { amount: true },
    }),

    db.retailInvoice.aggregate({
      where: { tenantId, soldAt: { gte: monthStart, lt: nextMonthStart } },
      _sum: { total: true },
    }),

    db.expense.aggregate({
      where: { tenantId, spentAt: { gte: monthStart, lt: nextMonthStart } },
      _sum: { amount: true },
    }),

    // Compare stock with each product's own reorder level in the database.
    db.product.count({
      where: { tenantId, isActive: true, quantity: { lte: db.product.fields.reorderLevel } },
    }),
    dashboardInsights(db, tenantId, now),
  ]);

  const membershipRevenueThisMonth = sum(renewalMonth._sum.amount);
  const retailRevenueThisMonth = sum(retailMonth._sum.total);

  return {
    activeMembers,
    renewalsDueThisWeek,
    renewalsOverdue,
    revenueToday: sum(renewalToday._sum.amount) + sum(retailToday._sum.total),
    revenueThisMonth: membershipRevenueThisMonth + retailRevenueThisMonth,
    membershipRevenueThisMonth,
    retailRevenueThisMonth,
    expensesThisMonth: sum(expenseMonth._sum.amount),
    lowStockCount: lowStock,
    ...insights,
  };
}
