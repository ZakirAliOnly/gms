import { BadgeDollarSign } from "lucide-react";
import { tenantDb } from "@/lib/tenant-db";
import { formatDate, formatMoney } from "@/lib/format";
import { startOfMonth, startOfNextMonth } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { AddExpenseDialog, CategoriesDialog, DeleteExpenseButton } from "./expense-dialogs";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const sp = await searchParams;
  const { db, tenantId } = await tenantDb("expenses");

  const now = new Date();
  const monthStart = startOfMonth(now);
  const nextMonth = startOfNextMonth(now);

  const [expenses, categories, methods, monthTotal] = await Promise.all([
    db.expense.findMany({
      where: { tenantId },
      orderBy: { spentAt: "desc" },
      take: 100,
      select: {
        id: true,
        amount: true,
        description: true,
        spentAt: true,
        category: { select: { name: true } },
        paymentMethod: { select: { name: true } },
      },
    }),
    db.expenseCategory.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.paymentMethod.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.expense.aggregate({
      where: { tenantId, spentAt: { gte: monthStart, lt: nextMonth } },
      _sum: { amount: true },
    }),
  ]);

  const thisMonth = monthTotal._sum.amount ? Number(monthTotal._sum.amount.toString()) : 0;

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Finance"
        title="Expenses"
        description="Operating costs. Each one is deducted from the payment method it was paid from."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <CategoriesDialog categories={categories} />
            <AddExpenseDialog
              key={sp.action ?? "default"}
              initiallyOpen={sp.action === "add"}
              categories={categories}
              methods={methods}
            />
          </div>
        }
      />

      <div className="border-border bg-card mt-6 flex flex-wrap items-baseline gap-3 rounded-lg border px-5 py-4">
        <p className="label-caps text-muted-foreground">This month</p>
        <p className="data-mono text-destructive text-2xl font-bold">{formatMoney(thisMonth)}</p>
      </div>

      {expenses.length === 0 ? (
        <div className="border-border bg-card mt-6 flex flex-col items-center justify-center rounded-lg border px-6 py-16 text-center">
          <BadgeDollarSign className="text-muted-foreground/50 size-8" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">No expenses yet</p>
          <p className="text-muted-foreground mt-1 text-[13px] leading-[18px]">
            Record one to start tracking operating costs.
          </p>
        </div>
      ) : (
        <div className="border-border bg-card mt-6 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-border bg-primary-tint border-b">
                <th className="label-caps text-muted-foreground px-4 py-3">Date</th>
                <th className="label-caps text-muted-foreground px-4 py-3">Category</th>
                <th className="label-caps text-muted-foreground px-4 py-3">Description</th>
                <th className="label-caps text-muted-foreground px-4 py-3">Paid from</th>
                <th className="label-caps text-muted-foreground px-4 py-3 text-right">Amount</th>
                <th className="label-caps text-muted-foreground px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id} className="border-border border-b last:border-0">
                  <td className="data-mono text-muted-foreground px-4 py-3">
                    {formatDate(expense.spentAt)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{expense.category.name}</td>
                  <td className="text-muted-foreground px-4 py-3 text-sm">
                    {expense.description ?? "—"}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-sm">
                    {expense.paymentMethod.name}
                  </td>
                  <td className="data-mono px-4 py-3 text-right font-medium">
                    {formatMoney(expense.amount.toString())}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <DeleteExpenseButton id={expense.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
