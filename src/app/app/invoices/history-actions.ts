"use server";

import { revalidatePath } from "@/lib/workspace-cache";
import { z } from "zod";
import { tenantDb } from "@/lib/tenant-db";
import { changeInvoice, readInvoice } from "@/lib/invoice-management";
import { createInvoiceSchema } from "@/lib/validators/invoice";

const identity = z.object({ id: z.string().trim().min(1), version: z.string().length(64) });
const editSchema = createInvoiceSchema.extend({
  ...identity.shape,
  discount: z.coerce
    .number()
    .nonnegative()
    .multipleOf(0.01, "Discount can have at most two decimal places.")
    .max(9999999999.99),
  lines: z
    .array(
      z.object({
        productId: z.string().trim().min(1),
        quantity: z.coerce.number().int().min(1).max(2147483647),
      })
    )
    .min(1, "Keep at least one item.")
    .max(100, "An invoice can contain at most 100 items."),
});

function refreshInvoices() {
  for (const path of [
    "/app/invoices",
    "/app/inventory",
    "/app/payment-methods",
    "/app/reports",
    "/app/data",
    "/app/activity-log",
    "/admin/activity-log",
    "/app",
  ])
    revalidatePath(path);
}

export async function getInvoiceDetails(id: string) {
  const { db, tenantId } = await tenantDb("invoices");
  if (typeof id !== "string" || !id.trim()) return { error: "Invoice not found." };
  const invoice = await readInvoice(db, tenantId, id);
  return invoice ? { invoice } : { error: "Invoice not found. Refresh the history." };
}

export async function updateInvoice(input: unknown) {
  const { db, tenantId, userId } = await tenantDb("invoices", "edit");
  const parsed = editSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Check the invoice details." };
  const { id, version, ...data } = parsed.data;
  const result = await changeInvoice(db, tenantId, userId, id, version, data);
  if ("ok" in result) refreshInvoices();
  return result;
}

export async function deleteInvoice(input: unknown) {
  const { db, tenantId, userId } = await tenantDb("invoices", "edit");
  const parsed = identity.safeParse(input);
  if (!parsed.success) return { error: "Invoice not found. Refresh the history." };
  const result = await changeInvoice(
    db,
    tenantId,
    userId,
    parsed.data.id,
    parsed.data.version,
    null
  );
  if ("ok" in result) refreshInvoices();
  return result;
}
