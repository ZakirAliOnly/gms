"use server";

import { revalidatePath } from "@/lib/workspace-cache";
import { z } from "zod";
import { activityTransaction } from "@/lib/activity-write";
import { tenantDb } from "@/lib/tenant-db";
import { recordExpense } from "@/lib/record-expense";

const expenseSchema = z.object({
  categoryId: z.string().trim().min(1, "Choose a category."),
  amount: z.coerce
    .number({ error: "Enter a valid amount." })
    .positive("Amount must be greater than zero.")
    .multipleOf(0.01, "Use no more than two decimal places.")
    .max(9999999999.99, "Amount is too large."),
  paymentMethodId: z.string().trim().min(1, "Choose a payment method."),
  description: z.string().trim().max(200).optional(),
  spentAt: z.string().trim().optional(),
});

const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(60),
});

export type ExpenseState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Payment-method balances are derived from expenses, so recording one has to
 * refresh that page too.
 */
function revalidateAll() {
  revalidatePath("/app/expenses");
  revalidatePath("/app/payment-methods");
  revalidatePath("/app");
}

/** Records an operating cost (FR-37). Reduces the chosen method's balance. */
export async function createExpense(
  _prev: ExpenseState,
  formData: FormData
): Promise<ExpenseState> {
  const { db, tenantId, userId } = await tenantDb("expenses", "edit");

  const parsed = expenseSchema.safeParse({
    categoryId: formData.get("categoryId"),
    amount: formData.get("amount"),
    paymentMethodId: formData.get("paymentMethodId"),
    description: formData.get("description"),
    spentAt: formData.get("spentAt"),
  });

  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        categoryId: f.categoryId?.[0] ?? "",
        amount: f.amount?.[0] ?? "",
        paymentMethodId: f.paymentMethodId?.[0] ?? "",
      },
    };
  }

  const { categoryId, amount, paymentMethodId, description, spentAt } = parsed.data;

  const result = await recordExpense(
    db,
    {
      tenantId,
      categoryId,
      amount,
      paymentMethodId,
      description: description || null,
      spentAt: spentAt ? new Date(spentAt) : new Date(),
    },
    userId
  );
  if (!("ok" in result)) return result;
  revalidateAll();
  revalidatePath("/admin/activity-log");
  return { ok: true };
}

/** Removes an expense and returns the money to its payment method. */
export async function deleteExpense(
  _prev: ExpenseState,
  formData: FormData
): Promise<ExpenseState> {
  const { db, tenantId, userId } = await tenantDb("expenses", "edit");

  const id = String(formData.get("id") ?? "");
  const existing = await db.expense.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return { error: "Expense not found." };

  await activityTransaction(
    db,
    { tenantId, actorId: userId, action: "EXPENSE_DELETE", target: id },
    (tx) => tx.expense.delete({ where: { id } })
  );

  revalidateAll();
  revalidatePath("/admin/activity-log");
  return { ok: true };
}

/** Expense categories are configurable per tenant (FR-38). */
export async function createCategory(
  _prev: ExpenseState,
  formData: FormData
): Promise<ExpenseState> {
  const { db, tenantId, userId } = await tenantDb("expenses", "edit");

  const parsed = categorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { fieldErrors: { name: parsed.error.flatten().fieldErrors.name?.[0] ?? "" } };
  }

  const { name } = parsed.data;

  const clash = await db.expenseCategory.findFirst({
    where: { tenantId, name },
    select: { id: true },
  });
  if (clash) return { fieldErrors: { name: "That category already exists." } };

  await activityTransaction(
    db,
    { tenantId, actorId: userId, action: "EXPENSE_CATEGORY_CREATE" },
    (tx) => tx.expenseCategory.create({ data: { tenantId, name, isActive: true } })
  );

  revalidatePath("/app/expenses");
  revalidatePath("/admin/activity-log");
  return { ok: true };
}
