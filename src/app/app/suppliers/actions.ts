"use server";

import { revalidatePath } from "@/lib/workspace-cache";
import { activityTransaction } from "@/lib/activity-write";
import { tenantDb } from "@/lib/tenant-db";
import { recordPurchase, payPurchase } from "@/lib/purchases";
import { BusinessError } from "@/lib/transaction";
import {
  addPurchasePaymentSchema,
  createPurchaseSchema,
  supplierSchema,
  updateSupplierSchema,
} from "@/lib/validators/supplier";

export type SupplierState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Purchase payments feed payment-method balances and the cash report, so a
 * change here has to refresh those views too.
 */
function revalidateAll() {
  revalidatePath("/app/suppliers");
  revalidatePath("/app/invoices");
  revalidatePath("/app/reports");
  revalidatePath("/app/data");
  revalidatePath("/app/inventory");
  revalidatePath("/app/payment-methods");
  revalidatePath("/app");
}

function supplierFieldErrors(error: {
  flatten(): { fieldErrors: Record<string, string[] | undefined> };
}) {
  const f = error.flatten().fieldErrors;
  return {
    name: f.name?.[0] ?? "",
    phone: f.phone?.[0] ?? "",
    email: f.email?.[0] ?? "",
    address: f.address?.[0] ?? "",
    notes: f.notes?.[0] ?? "",
  };
}

export async function createSupplier(
  _prev: SupplierState,
  formData: FormData
): Promise<SupplierState> {
  const { db, tenantId, userId } = await tenantDb("suppliers", "edit");

  const parsed = supplierSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) return { fieldErrors: supplierFieldErrors(parsed.error) };

  const { name, phone, email, address, notes } = parsed.data;

  await activityTransaction(db, { tenantId, actorId: userId, action: "SUPPLIER_CREATE" }, (tx) =>
    tx.supplier.create({
      data: {
        tenantId,
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null,
      },
    })
  );

  revalidatePath("/app/suppliers");
  revalidatePath("/admin/activity-log");
  return { ok: true };
}

export async function updateSupplier(
  _prev: SupplierState,
  formData: FormData
): Promise<SupplierState> {
  const { db, tenantId, userId } = await tenantDb("suppliers", "edit");

  const parsed = updateSupplierSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) return { fieldErrors: supplierFieldErrors(parsed.error) };

  const { id, name, phone, email, address, notes } = parsed.data;

  const existing = await db.supplier.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return { error: "Supplier not found." };

  await activityTransaction(
    db,
    { tenantId, actorId: userId, action: "SUPPLIER_EDIT", target: id },
    (tx) =>
      tx.supplier.update({
        where: { id },
        data: {
          name,
          phone: phone || null,
          email: email || null,
          address: address || null,
          notes: notes || null,
        },
      })
  );

  revalidatePath("/app/suppliers");
  revalidatePath("/admin/activity-log");
  return { ok: true };
}

/** Record a received supplier invoice, its FIFO receipts, and any initial payment. */
export async function createPurchase(input: unknown): Promise<SupplierState> {
  const { db, tenantId, userId } = await tenantDb("suppliers", "edit");
  const parsed = createPurchaseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid purchase." };
  try {
    await recordPurchase(db, tenantId, userId, parsed.data);
  } catch (error) {
    if (error instanceof BusinessError) return { error: error.message };
    throw error;
  }
  revalidateAll();
  revalidatePath("/admin/activity-log");
  return { ok: true };
}

export async function addPurchasePayment(
  _prev: SupplierState,
  formData: FormData
): Promise<SupplierState> {
  const { db, tenantId, userId } = await tenantDb("suppliers", "edit");
  const parsed = addPurchasePaymentSchema.safeParse({
    purchaseInvoiceId: formData.get("purchaseInvoiceId"),
    amount: formData.get("amount"),
    paymentMethodId: formData.get("paymentMethodId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid payment." };
  try {
    await payPurchase(db, tenantId, userId, parsed.data);
  } catch (error) {
    if (error instanceof BusinessError) return { error: error.message };
    throw error;
  }
  revalidateAll();
  revalidatePath("/admin/activity-log");
  return { ok: true };
}
