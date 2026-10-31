import type { PrismaClient } from "@/generated/prisma/client";
import { membershipFilter } from "./membership-filter";
import { formatDate } from "./format";
import { reportRange } from "./report-range";

export type ReportSection = {
  title: string;
  note?: string;
  columns: string[];
  rows: (string | number)[][];
};
const num = (value: unknown) => Number(value ?? 0);
const money = (value: number) => Math.round(value * 100) / 100;

/** Every query is scoped to the branch resolved by the caller. */
export async function buildReports(
  db: PrismaClient,
  tenantId: string,
  range: ReturnType<typeof reportRange>,
  now = new Date()
): Promise<ReportSection[]> {
  const dates = { gte: range.gte, lt: range.lt };
  const [
    active,
    due,
    overdue,
    newMembers,
    renewals,
    sales,
    products,
    movements,
    purchases,
    expenses,
    methods,
    payments,
    transfers,
  ] = await Promise.all([
    db.membership.count({ where: membershipFilter("active", tenantId, now) }),
    db.membership.count({ where: membershipFilter("renewals", tenantId, now) }),
    db.membership.count({ where: membershipFilter("overdue", tenantId, now) }),
    db.member.count({ where: { tenantId, joinDate: dates } }),
    db.renewalPayment.findMany({
      where: { tenantId, recordedAt: dates },
      select: { amount: true, paymentMethodId: true },
    }),
    db.retailInvoice.findMany({
      where: { tenantId, soldAt: dates },
      include: { lines: { include: { product: { select: { name: true, category: true } } } } },
    }),
    db.product.findMany({
      where: { tenantId },
      orderBy: { serial: "asc" },
      include: { stockLots: { where: { remaining: { gt: 0 } } } },
    }),
    db.stockMovement.findMany({
      where: { tenantId, createdAt: dates },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { product: { select: { name: true } } },
    }),
    db.purchaseInvoice.findMany({
      where: { tenantId, invoiceDate: dates },
      include: {
        supplier: { select: { name: true } },
        payments: { where: { paidAt: { lt: range.lt } } },
      },
    }),
    db.expense.findMany({
      where: { tenantId, spentAt: dates },
      include: { category: { select: { name: true } } },
    }),
    db.paymentMethod.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    db.purchasePayment.findMany({
      where: { tenantId, paidAt: dates },
      select: { paymentMethodId: true, amount: true },
    }),
    db.paymentTransfer.findMany({ where: { tenantId, transferredAt: dates } }),
  ]);
  const productSales = new Map<
    string,
    {
      name: string;
      category: string;
      quantity: number;
      gross: number;
      discount: number;
      cost: number;
      unknown: number;
    }
  >();
  for (const sale of sales) {
    let remainingDiscount = Math.round(num(sale.discount) * 100);
    sale.lines.forEach((line, index) => {
      const discount =
        index === sale.lines.length - 1
          ? remainingDiscount
          : Math.min(
              remainingDiscount,
              num(sale.subtotal)
                ? Math.round((num(sale.discount) * 100 * num(line.lineTotal)) / num(sale.subtotal))
                : 0
            );
      remainingDiscount -= discount;
      const row = productSales.get(line.productId) ?? {
        name: line.product.name,
        category: line.product.category ?? "Uncategorised",
        quantity: 0,
        gross: 0,
        discount: 0,
        cost: 0,
        unknown: 0,
      };
      row.quantity += line.quantity;
      row.gross += num(line.lineTotal);
      row.discount += discount / 100;
      if (line.costTotal === null) row.unknown += line.quantity;
      else row.cost += num(line.costTotal);
      productSales.set(line.productId, row);
    });
  }
  const suppliers = new Map<string, { name: string; total: number; paid: number }>();
  for (const invoice of purchases) {
    const row = suppliers.get(invoice.supplierId) ?? {
      name: invoice.supplier.name,
      total: 0,
      paid: 0,
    };
    row.total += num(invoice.total);
    row.paid += invoice.payments.reduce((n, p) => n + num(p.amount), 0);
    suppliers.set(invoice.supplierId, row);
  }
  const categories = new Map<string, { name: string; amount: number }>();
  for (const expense of expenses) {
    const row = categories.get(expense.categoryId) ?? { name: expense.category.name, amount: 0 };
    row.amount += num(expense.amount);
    categories.set(expense.categoryId, row);
  }
  const categorySales = new Map<string, { quantity: number; revenue: number }>();
  for (const row of productSales.values()) {
    const category = categorySales.get(row.category) ?? { quantity: 0, revenue: 0 };
    category.quantity += row.quantity;
    category.revenue += row.gross - row.discount;
    categorySales.set(row.category, category);
  }
  return [
    {
      title: "Memberships",
      note: "Active, due and overdue are current figures. Collections and new members use the selected period.",
      columns: ["Metric", "Value"],
      rows: [
        ["Active members now", active],
        ["Due in the next 7 days", due],
        ["Overdue now", overdue],
        ["New members in period", newMembers],
        ["Payments collected in period", renewals.length],
        ["Membership revenue PKR", money(renewals.reduce((n, p) => n + num(p.amount), 0))],
      ],
    },
    {
      title: "Retail sales",
      note: "Revenue is after allocated discounts. Historical sales may have unknown costs. Opening and manual receipt costs use recorded estimates.",
      columns: [
        "Product",
        "Category",
        "Units sold",
        "Gross PKR",
        "Discount PKR",
        "Revenue PKR",
        "Known FIFO cost PKR",
        "Units with unknown cost",
      ],
      rows: [...productSales.values()].map((r) => [
        r.name,
        r.category,
        r.quantity,
        money(r.gross),
        money(r.discount),
        money(r.gross - r.discount),
        money(r.cost),
        r.unknown,
      ]),
    },
    {
      title: "Sales by category",
      columns: ["Category", "Units sold", "Revenue PKR"],
      rows: [...categorySales].map(([name, r]) => [name, r.quantity, money(r.revenue)]),
    },
    {
      title: "Inventory",
      note: "Current balances, independent of the date filter. FIFO value uses remaining receipt costs; opening and manual lots may be estimates.",
      columns: ["Product", "Status", "On hand", "Reorder level", "Low stock", "FIFO value PKR"],
      rows: products.map((p) => [
        p.name,
        p.isActive ? "Active" : "Archived",
        p.quantity,
        p.reorderLevel,
        p.isActive && p.quantity <= p.reorderLevel ? "Yes" : "No",
        money(p.stockLots.reduce((n, lot) => n + lot.remaining * num(lot.unitCost), 0)),
      ]),
    },
    {
      title: "Stock movements",
      columns: ["Date", "Product", "Type", "Quantity change", "Document", "Reason"],
      rows: movements.map((m) => [
        formatDate(m.createdAt),
        m.product.name,
        m.type,
        m.quantityDelta,
        m.reference ?? "",
        m.reason ?? "",
      ]),
    },
    {
      title: "Supplier purchases",
      note: "Invoices dated in the selected period; payments and outstanding amounts are measured through the period end.",
      columns: ["Supplier", "Purchases PKR", "Paid PKR", "Outstanding PKR"],
      rows: [...suppliers.values()].map((s) => [
        s.name,
        money(s.total),
        money(s.paid),
        money(s.total - s.paid),
      ]),
    },
    {
      title: "Expenses",
      columns: ["Category", "Amount PKR"],
      rows: [...categories.values()].map((r) => [r.name, money(r.amount)]),
    },
    {
      title: "Cash by payment method",
      note: "Supplier payments appear once as outflow, separately from operating expenses. Transfers move funds between methods. Opening balances are excluded from period movement.",
      columns: [
        "Method",
        "Membership PKR",
        "Retail PKR",
        "Expenses PKR",
        "Supplier payments PKR",
        "Transfers in PKR",
        "Transfers out PKR",
        "Net movement PKR",
      ],
      rows: methods.map((method) => {
        const membership = renewals
          .filter((p) => p.paymentMethodId === method.id)
          .reduce((n, p) => n + num(p.amount), 0);
        const retail = sales
          .filter((s) => s.paymentMethodId === method.id)
          .reduce((n, s) => n + num(s.total), 0);
        const expense = expenses
          .filter((e) => e.paymentMethodId === method.id)
          .reduce((n, e) => n + num(e.amount), 0);
        const supplier = payments
          .filter((p) => p.paymentMethodId === method.id)
          .reduce((n, p) => n + num(p.amount), 0);
        const incoming = transfers
          .filter((t) => t.toMethodId === method.id)
          .reduce((n, t) => n + num(t.amount), 0);
        const outgoing = transfers
          .filter((t) => t.fromMethodId === method.id)
          .reduce((n, t) => n + num(t.amount), 0);
        return [
          method.name,
          membership,
          retail,
          expense,
          supplier,
          incoming,
          outgoing,
          membership + retail - expense - supplier + incoming - outgoing,
        ].map((v) => (typeof v === "number" ? money(v) : v));
      }),
    },
  ];
}
