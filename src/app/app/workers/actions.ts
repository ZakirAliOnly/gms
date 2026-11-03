"use server";

import { z } from "zod";
import { revalidatePath } from "@/lib/workspace-cache";
import { activityTransaction } from "@/lib/activity-write";
import { tenantDb } from "@/lib/tenant-db";
import { phoneOptional } from "@/lib/validators/phone";
import { BusinessError } from "@/lib/transaction";
import { computePayroll, isMonth, monthLabel, payOutExpense, toNum } from "@/lib/workers";

export type WorkerState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const money = (label: string) =>
  z.coerce
    .number({ error: `Enter a valid ${label}.` })
    .positive(`${label[0].toUpperCase()}${label.slice(1)} must be greater than zero.`)
    .multipleOf(0.01, "Use no more than two decimal places.")
    .max(9999999999.99, "Amount is too large.");

const optionalMoney = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? 0 : v),
  z.coerce
    .number({ error: "Enter a valid amount." })
    .min(0, "Cannot be negative.")
    .multipleOf(0.01, "Use no more than two decimal places.")
    .max(9999999999.99, "Amount is too large.")
);

const monthField = z.string().refine(isMonth, "Choose a valid month.");
const dateField = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? new Date(`${v}T12:00:00`) : new Date()))
  .refine((d) => !Number.isNaN(d.getTime()), "Enter a valid date.");

const workerSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  role: z.string().trim().max(60).optional(),
  phone: phoneOptional,
  monthlyWage: money("wage"),
  extraHoursRate: optionalMoney,
  isActive: z.enum(["true", "false"]),
});

function fieldErrors(error: z.ZodError): WorkerState {
  const flat = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  return {
    fieldErrors: Object.fromEntries(
      Object.entries(flat).map(([key, messages]) => [key, messages?.[0] ?? ""])
    ),
  };
}

function refresh() {
  revalidatePath("/app/workers");
  revalidatePath("/app/expenses");
  revalidatePath("/app/payment-methods");
  revalidatePath("/app");
  revalidatePath("/admin/activity-log");
}

/** Thrown inside a transaction so it rolls back and writes no activity entry. */
class StateError extends Error {
  constructor(readonly state: WorkerState) {
    super(state.error ?? "Invalid input");
  }
}

/** Maps a thrown BusinessError (e.g. from a retried transaction) to form state. */
function failure(error: unknown): WorkerState {
  if (error instanceof StateError) return error.state;
  if (error instanceof BusinessError) return { error: error.message };
  throw error;
}

export async function saveWorker(_prev: WorkerState, formData: FormData): Promise<WorkerState> {
  const { db, tenantId, userId } = await tenantDb("workers", "edit");
  const parsed = workerSchema.safeParse({
    name: formData.get("name"),
    role: formData.get("role") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    monthlyWage: formData.get("monthlyWage"),
    extraHoursRate: formData.get("extraHoursRate"),
    isActive: formData.get("isActive") ?? "true",
  });
  if (!parsed.success) return fieldErrors(parsed.error);
  const { name, role, phone, monthlyWage, extraHoursRate, isActive } = parsed.data;
  const data = {
    name,
    role: role || null,
    phone: phone || null,
    monthlyWage,
    extraHoursRate,
    isActive: isActive === "true",
  };

  const id = String(formData.get("id") ?? "");
  try {
    if (id) {
      const existing = await db.worker.findFirst({ where: { id, tenantId }, select: { id: true } });
      if (!existing) return { error: "Worker not found." };
      await activityTransaction(db, { tenantId, actorId: userId, action: "WORKER_EDIT" }, (tx) =>
        tx.worker.update({ where: { id }, data })
      );
    } else {
      await activityTransaction(db, { tenantId, actorId: userId, action: "WORKER_CREATE" }, (tx) =>
        tx.worker.create({ data: { ...data, tenantId } })
      );
    }
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}

/**
 * Deleting a worker removes their payroll history. The money already paid
 * stays in Expenses: those rows are real cash-outs.
 */
export async function deleteWorker(_prev: WorkerState, formData: FormData): Promise<WorkerState> {
  const { db, tenantId, userId } = await tenantDb("workers", "edit");
  const id = String(formData.get("id") ?? "");
  const existing = await db.worker.findFirst({
    where: { id, tenantId },
    select: { id: true, name: true },
  });
  if (!existing) return { error: "Worker not found." };
  try {
    await activityTransaction(
      db,
      {
        tenantId,
        actorId: userId,
        action: "WORKER_DELETE",
        target: id,
        meta: { name: existing.name },
      },
      (tx) => tx.worker.delete({ where: { id } })
    );
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}

const advanceSchema = z.object({
  workerId: z.string().min(1),
  month: monthField,
  amount: money("amount"),
  paymentMethodId: z.string().trim().min(1, "Choose a payment method."),
  note: z.string().trim().max(200).optional(),
  paidAt: dateField,
});

export async function addAdvance(_prev: WorkerState, formData: FormData): Promise<WorkerState> {
  const { db, tenantId, userId } = await tenantDb("workers", "edit");
  const parsed = advanceSchema.safeParse({
    workerId: formData.get("workerId"),
    month: formData.get("month"),
    amount: formData.get("amount"),
    paymentMethodId: formData.get("paymentMethodId"),
    note: formData.get("note") ?? undefined,
    paidAt: formData.get("paidAt") ?? undefined,
  });
  if (!parsed.success) return fieldErrors(parsed.error);
  const { workerId, month, amount, paymentMethodId, note, paidAt } = parsed.data;

  try {
    await activityTransaction(
      db,
      { tenantId, actorId: userId, action: "WORKER_ADVANCE" },
      async (tx) => {
        const worker = await tx.worker.findFirst({
          where: { id: workerId, tenantId },
          select: { name: true },
        });
        if (!worker) throw new StateError({ error: "Worker not found." });
        const paid = await tx.workerWagePayment.findUnique({
          where: { workerId_month: { workerId, month } },
          select: { id: true },
        });
        if (paid)
          throw new StateError({
            error: `${monthLabel(month)} wages are already paid. Undo them to add an advance.`,
          });

        const out = await payOutExpense(tx, {
          tenantId,
          paymentMethodId,
          amount,
          description: `Advance - ${worker.name} (${monthLabel(month)})`,
          spentAt: paidAt,
        });
        if ("fieldErrors" in out) throw new StateError({ fieldErrors: out.fieldErrors });
        await tx.workerAdvance.create({
          data: {
            tenantId,
            workerId,
            month,
            amount,
            note: note || null,
            paidAt,
            expenseId: out.expenseId,
          },
        });
        return { name: worker.name, amount, paymentMethodId };
      }
    );
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}

export async function deleteAdvance(_prev: WorkerState, formData: FormData): Promise<WorkerState> {
  const { db, tenantId, userId } = await tenantDb("workers", "edit");
  const id = String(formData.get("id") ?? "");
  try {
    await activityTransaction(
      db,
      { tenantId, actorId: userId, action: "WORKER_ADVANCE_DELETE", target: id },
      async (tx) => {
        const advance = await tx.workerAdvance.findFirst({
          where: { id, tenantId },
          select: {
            id: true,
            expenseId: true,
            workerId: true,
            month: true,
            amount: true,
            expense: { select: { paymentMethodId: true } },
          },
        });
        if (!advance) throw new StateError({ error: "Advance not found." });
        const paid = await tx.workerWagePayment.findUnique({
          where: { workerId_month: { workerId: advance.workerId, month: advance.month } },
          select: { id: true },
        });
        if (paid)
          throw new StateError({
            error: `${monthLabel(advance.month)} wages are already paid. Undo them first.`,
          });
        await tx.workerAdvance.delete({ where: { id } });
        await tx.expense.delete({ where: { id: advance.expenseId } });
        return { amount: toNum(advance.amount), paymentMethodId: advance.expense.paymentMethodId };
      }
    );
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}

const extraSchema = z.object({
  workerId: z.string().min(1),
  month: monthField,
  hours: z.coerce
    .number({ error: "Enter the hours." })
    .positive("Hours must be greater than zero.")
    .max(744, "Too many hours for one month.")
    .multipleOf(0.01, "Use no more than two decimal places."),
  rate: money("rate"),
  note: z.string().trim().max(200).optional(),
});

export async function addExtraHours(_prev: WorkerState, formData: FormData): Promise<WorkerState> {
  const { db, tenantId, userId } = await tenantDb("workers", "edit");
  const parsed = extraSchema.safeParse({
    workerId: formData.get("workerId"),
    month: formData.get("month"),
    hours: formData.get("hours"),
    rate: formData.get("rate"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) return fieldErrors(parsed.error);
  const { workerId, month, hours, rate, note } = parsed.data;
  const amount = Math.round(hours * rate * 100) / 100;

  try {
    await activityTransaction(
      db,
      { tenantId, actorId: userId, action: "WORKER_EXTRA_HOURS" },
      async (tx) => {
        const worker = await tx.worker.findFirst({
          where: { id: workerId, tenantId },
          select: { name: true },
        });
        if (!worker) throw new StateError({ error: "Worker not found." });
        const paid = await tx.workerWagePayment.findUnique({
          where: { workerId_month: { workerId, month } },
          select: { id: true },
        });
        if (paid)
          throw new StateError({
            error: `${monthLabel(month)} wages are already paid. Undo them to add hours.`,
          });
        await tx.workerExtraHours.create({
          data: { tenantId, workerId, month, hours, rate, amount, note: note || null },
        });
        // Extra hours are payable, not paid, so they are logged without a cash figure.
        return { name: worker.name };
      }
    );
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}

export async function deleteExtraHours(
  _prev: WorkerState,
  formData: FormData
): Promise<WorkerState> {
  const { db, tenantId } = await tenantDb("workers", "edit");
  const id = String(formData.get("id") ?? "");
  const entry = await db.workerExtraHours.findFirst({
    where: { id, tenantId },
    select: { id: true, workerId: true, month: true },
  });
  if (!entry) return { error: "Entry not found." };
  const paid = await db.workerWagePayment.findUnique({
    where: { workerId_month: { workerId: entry.workerId, month: entry.month } },
    select: { id: true },
  });
  if (paid) return { error: `${monthLabel(entry.month)} wages are already paid. Undo them first.` };
  await db.workerExtraHours.delete({ where: { id } });
  refresh();
  return { ok: true };
}

const paySchema = z.object({
  workerId: z.string().min(1),
  month: monthField,
  absentDays: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : v),
    z.coerce
      .number({ error: "Enter the absent days." })
      .min(0, "Cannot be negative.")
      .max(31, "A month has at most 31 days.")
      .multipleOf(0.5, "Use whole or half days.")
  ),
  paymentMethodId: z.string().trim().min(1, "Choose a payment method."),
  note: z.string().trim().max(200).optional(),
  paidAt: dateField,
});

/**
 * Pays one worker for one month. Extra hours and advances are re-read inside
 * the transaction, so the amount paid always matches what the database holds,
 * not what the dialog showed when it opened.
 */
export async function payWages(_prev: WorkerState, formData: FormData): Promise<WorkerState> {
  const { db, tenantId, userId } = await tenantDb("workers", "edit");
  const parsed = paySchema.safeParse({
    workerId: formData.get("workerId"),
    month: formData.get("month"),
    absentDays: formData.get("absentDays"),
    paymentMethodId: formData.get("paymentMethodId"),
    note: formData.get("note") ?? undefined,
    paidAt: formData.get("paidAt") ?? undefined,
  });
  if (!parsed.success) return fieldErrors(parsed.error);
  const { workerId, month, absentDays, paymentMethodId, note, paidAt } = parsed.data;

  try {
    await activityTransaction(
      db,
      { tenantId, actorId: userId, action: "WORKER_WAGE_PAY" },
      async (tx) => {
        const worker = await tx.worker.findFirst({
          where: { id: workerId, tenantId },
          select: { name: true, monthlyWage: true },
        });
        if (!worker) throw new StateError({ error: "Worker not found." });
        const already = await tx.workerWagePayment.findUnique({
          where: { workerId_month: { workerId, month } },
          select: { id: true },
        });
        if (already)
          throw new StateError({ error: `${monthLabel(month)} wages are already paid.` });

        const [extra, advances] = await Promise.all([
          tx.workerExtraHours.aggregate({
            where: { tenantId, workerId, month },
            _sum: { amount: true },
          }),
          tx.workerAdvance.aggregate({
            where: { tenantId, workerId, month },
            _sum: { amount: true },
          }),
        ]);
        const payroll = computePayroll({
          monthlyWage: toNum(worker.monthlyWage),
          extra: toNum(extra._sum.amount),
          absentDays,
          advances: toNum(advances._sum.amount),
        });
        if (payroll.net <= 0)
          throw new StateError({
            error: "Nothing left to pay: advances and absence cover the whole wage.",
          });

        const out = await payOutExpense(tx, {
          tenantId,
          paymentMethodId,
          amount: payroll.net,
          description: `Wages - ${worker.name} (${monthLabel(month)})`,
          spentAt: paidAt,
        });
        if ("fieldErrors" in out) throw new StateError({ fieldErrors: out.fieldErrors });

        await tx.workerWagePayment.create({
          data: {
            tenantId,
            workerId,
            month,
            baseWage: payroll.monthlyWage,
            extraAmount: payroll.extra,
            absentDays,
            absenceDeduction: payroll.absence,
            advancesDeducted: payroll.advances,
            netPaid: payroll.net,
            note: note || null,
            paidAt,
            expenseId: out.expenseId,
          },
        });
        return { name: worker.name, amount: payroll.net, paymentMethodId };
      }
    );
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}

/** Reverses a wage payment and returns the money to its payment method. */
export async function undoWages(_prev: WorkerState, formData: FormData): Promise<WorkerState> {
  const { db, tenantId, userId } = await tenantDb("workers", "edit");
  const id = String(formData.get("id") ?? "");
  try {
    await activityTransaction(
      db,
      { tenantId, actorId: userId, action: "WORKER_WAGE_UNDO", target: id },
      async (tx) => {
        const payment = await tx.workerWagePayment.findFirst({
          where: { id, tenantId },
          select: {
            id: true,
            expenseId: true,
            netPaid: true,
            expense: { select: { paymentMethodId: true } },
          },
        });
        if (!payment) throw new StateError({ error: "Payment not found." });
        await tx.workerWagePayment.delete({ where: { id } });
        await tx.expense.delete({ where: { id: payment.expenseId } });
        return { amount: toNum(payment.netPaid), paymentMethodId: payment.expense.paymentMethodId };
      }
    );
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}
