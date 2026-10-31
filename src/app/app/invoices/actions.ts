"use server";

import { revalidatePath } from "@/lib/workspace-cache";
import { recordSale } from "@/lib/retail-sale";
import { BusinessError } from "@/lib/transaction";
import { tenantDb } from "@/lib/tenant-db";
import { createInvoiceSchema } from "@/lib/validators/invoice";
import type { InvoiceReceipt } from "./invoice-receipt";

export type SaleState = {
  ok?: boolean;
  error?: string;
  invoiceNumber?: string;
  invoice?: InvoiceReceipt;
};

/**
 * Records a retail sale (FR-29, FR-30).
 *
 * Everything happens in one transaction: the invoice, its lines, the stock
 * decrements, and the stock-movement audit trail. A sale that reduced stock
 * without recording the invoice - or vice versa - would corrupt both the
 * inventory count and the cash report.
 *
 * Prices come from the database, never the client: a posted price would let
 * anyone sell at whatever figure they liked.
 */
export async function createSale(input: unknown): Promise<SaleState> {
  const { db, tenantId, userId } = await tenantDb();

  const parsed = createInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid sale." };
  }

  let result;
  try {
    result = await recordSale(db, tenantId, userId, parsed.data);
  } catch (error) {
    if (error instanceof BusinessError) return { error: error.message };
    throw error;
  }
  const { saved, products, member, method, tenant } = result;
  revalidatePath("/app/invoices");
  revalidatePath("/app/inventory");
  revalidatePath("/app/payment-methods");
  revalidatePath("/app");

  revalidatePath("/admin/activity-log");
  return {
    ok: true,
    invoiceNumber: saved.number,
    invoice: {
      number: saved.number,
      soldAt: saved.soldAt.toISOString(),
      businessName: tenant.name,
      location: tenant.location,
      customer: member?.name ?? "Walk-in customer",
      paymentMethod: method.name,
      subtotal: saved.subtotal.toString(),
      discount: saved.discount.toString(),
      total: saved.total.toString(),
      lines: saved.lines.map((line) => ({
        name: products.find((product) => product.id === line.productId)!.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice.toString(),
        total: line.lineTotal.toString(),
      })),
    },
  };
}
