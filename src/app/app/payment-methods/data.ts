import { db } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { tenantDb } from "@/lib/tenant-db";

export type MethodBalance = {
  id: string;
  name: string;
  isActive: boolean;
  openingBalance: number;
  /** Opening plus every movement recorded against this method. */
  currentBalance: number;
  /** How many money records reference it, transfers included. */
  usageCount: number;
  branch: string;
  branchId: string;
};

export type TransferRow = {
  id: string;
  fromName: string;
  toName: string;
  amount: number;
  note: string | null;
  transferredAt: Date;
};

function num(value: { toString(): string } | null | undefined): number {
  return value ? Number(value.toString()) : 0;
}

/**
 * Every method with its running balance.
 *
 * current = opening
 *         + membership renewals + retail sales   (money in)
 *         - expenses - supplier payments          (money out)
 *         + transfers in - transfers out          (money moved between channels)
 *
 * Totals are aggregated per method in SQL rather than by walking rows in JS,
 * so this stays flat as the ledger grows.
 */
export async function getMethodBalances(): Promise<MethodBalance[]> {
  const { tenantId } = await tenantDb("payment-methods");
  return queryMethodBalances(tenantId);
}

export async function getAdminMethodBalances(branch?: string) {
  await requireRole("ADMIN");
  return queryMethodBalances(branch);
}

async function queryMethodBalances(tenantId?: string): Promise<MethodBalance[]> {
  const [methods, renewals, sales, expenses, purchases, out, incoming] = await Promise.all([
    db.paymentMethod.findMany({
      where: { tenantId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        tenant: { select: { id: true, name: true } },
        id: true,
        name: true,
        isActive: true,
        openingBalance: true,
      },
    }),
    db.renewalPayment.groupBy({
      by: ["paymentMethodId"],
      where: { tenantId },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.retailInvoice.groupBy({
      by: ["paymentMethodId"],
      where: { tenantId },
      _sum: { total: true },
      _count: { _all: true },
    }),
    db.expense.groupBy({
      by: ["paymentMethodId"],
      where: { tenantId },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.purchasePayment.groupBy({
      by: ["paymentMethodId"],
      where: { tenantId },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.paymentTransfer.groupBy({
      by: ["fromMethodId"],
      where: { tenantId },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.paymentTransfer.groupBy({
      by: ["toMethodId"],
      where: { tenantId },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const index = <T extends { _sum: Record<string, unknown>; _count: { _all: number } }>(
    rows: T[],
    key: keyof T,
    sumField: string
  ) => {
    const map = new Map<string, { sum: number; count: number }>();
    for (const row of rows) {
      const id = row[key] as unknown as string;
      map.set(id, {
        sum: num(row._sum[sumField] as never),
        count: row._count._all,
      });
    }
    return map;
  };

  const renewalBy = index(renewals, "paymentMethodId", "amount");
  const salesBy = index(sales, "paymentMethodId", "total");
  const expenseBy = index(expenses, "paymentMethodId", "amount");
  const purchaseBy = index(purchases, "paymentMethodId", "amount");
  const outBy = index(out, "fromMethodId", "amount");
  const inBy = index(incoming, "toMethodId", "amount");

  return methods.map((method) => {
    const opening = num(method.openingBalance);

    const inflow =
      (renewalBy.get(method.id)?.sum ?? 0) +
      (salesBy.get(method.id)?.sum ?? 0) +
      (inBy.get(method.id)?.sum ?? 0);

    const outflow =
      (expenseBy.get(method.id)?.sum ?? 0) +
      (purchaseBy.get(method.id)?.sum ?? 0) +
      (outBy.get(method.id)?.sum ?? 0);

    const usageCount =
      (renewalBy.get(method.id)?.count ?? 0) +
      (salesBy.get(method.id)?.count ?? 0) +
      (expenseBy.get(method.id)?.count ?? 0) +
      (purchaseBy.get(method.id)?.count ?? 0) +
      (outBy.get(method.id)?.count ?? 0) +
      (inBy.get(method.id)?.count ?? 0);

    return {
      branch: method.tenant.name,
      branchId: method.tenant.id,
      id: method.id,
      name: method.name,
      isActive: method.isActive,
      openingBalance: opening,
      currentBalance: opening + inflow - outflow,
      usageCount,
    };
  });
}

export type TransferRange = "all" | "today" | "week" | "month";

/** Transfers, newest first, optionally windowed. */
export async function getTransfers(range: TransferRange = "all"): Promise<TransferRow[]> {
  const { db, tenantId } = await tenantDb("payment-methods");

  const now = new Date();
  let since: Date | undefined;

  if (range === "today") {
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (range === "week") {
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  } else if (range === "month") {
    since = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const rows = await db.paymentTransfer.findMany({
    where: { tenantId, ...(since ? { transferredAt: { gte: since } } : {}) },
    orderBy: { transferredAt: "desc" },
    take: 100,
    select: {
      id: true,
      amount: true,
      note: true,
      transferredAt: true,
      fromMethod: { select: { name: true } },
      toMethod: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    fromName: r.fromMethod.name,
    toName: r.toMethod.name,
    amount: num(r.amount),
    note: r.note,
    transferredAt: r.transferredAt,
  }));
}
