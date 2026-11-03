import type { Prisma } from "@/generated/prisma/client";
import { TIME_ZONE } from "./format";
import { getMethodBalance } from "./payment-method-balance";

/** Payroll months are stored as "YYYY-MM" in the tenant's timezone. */
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

const monthFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
});
const labelFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

export function currentMonth(now = new Date()): string {
  return monthFormat.format(now).slice(0, 7);
}

/** A valid month, or the current one when the input is missing or malformed. */
export function parseMonth(value: string | null | undefined): string {
  return value && MONTH_RE.test(value) ? value : currentMonth();
}

export function isMonth(value: string): boolean {
  return MONTH_RE.test(value);
}

export function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return labelFormat.format(new Date(Date.UTC(year, m - 1, 1)));
}

/** The current month and the previous 11, newest first. The selected month is always included. */
export function monthOptions(
  selected: string,
  now = new Date()
): { value: string; label: string }[] {
  const [year, m] = currentMonth(now).split("-").map(Number);
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(year, m - 1 - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  if (!months.includes(selected)) months.push(selected);
  return months
    .sort()
    .reverse()
    .map((value) => ({ value, label: monthLabel(value) }));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** One day's wage is the monthly wage over 30 days, whatever the month length. */
export function dailyWage(monthlyWage: number): number {
  return round2(monthlyWage / 30);
}

export type Payroll = {
  monthlyWage: number;
  extra: number;
  absence: number;
  adjustedGross: number;
  advances: number;
  net: number;
};

export function computePayroll(input: {
  monthlyWage: number;
  extra: number;
  absentDays: number;
  advances: number;
}): Payroll {
  const absence = round2(input.absentDays * dailyWage(input.monthlyWage));
  const adjustedGross = round2(input.monthlyWage + input.extra - absence);
  return {
    monthlyWage: input.monthlyWage,
    extra: input.extra,
    absence,
    adjustedGross,
    advances: input.advances,
    net: round2(adjustedGross - input.advances),
  };
}

type Money = { toString(): string } | null | undefined;
export const toNum = (value: Money) => (value ? Number(value.toString()) : 0);

export const WAGES_CATEGORY = "Salaries & Wages";

type Outcome = { expenseId: string } | { fieldErrors: Record<string, string> };

/**
 * Pays money out to a worker as an Expense, so the payment method's balance,
 * the cash report and the dashboard all see it without special cases. Runs
 * inside the caller's transaction so the expense and its payroll record commit
 * or roll back together.
 */
export async function payOutExpense(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    paymentMethodId: string;
    amount: number;
    description: string;
    spentAt: Date;
  }
): Promise<Outcome> {
  const { tenantId, paymentMethodId, amount } = input;

  const method = await tx.paymentMethod.findFirst({
    where: { id: paymentMethodId, tenantId, isActive: true },
    select: { id: true },
  });
  if (!method) return { fieldErrors: { paymentMethodId: "That payment method is unavailable." } };

  const balance = await getMethodBalance(tx, tenantId, paymentMethodId);
  if (Math.round(amount * 100) > Math.round(balance * 100)) {
    return {
      fieldErrors: {
        paymentMethodId: `Not enough funds. ${balance.toFixed(2)} available in that method.`,
      },
    };
  }

  const category =
    (await tx.expenseCategory.findFirst({
      where: { tenantId, name: WAGES_CATEGORY },
      select: { id: true },
    })) ??
    (await tx.expenseCategory.create({
      data: { tenantId, name: WAGES_CATEGORY },
      select: { id: true },
    }));

  const expense = await tx.expense.create({
    data: {
      tenantId,
      categoryId: category.id,
      paymentMethodId,
      amount,
      description: input.description,
      spentAt: input.spentAt,
    },
    select: { id: true },
  });
  return { expenseId: expense.id };
}
