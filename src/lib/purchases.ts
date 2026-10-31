import type { PrismaClient } from "@/generated/prisma/client";
import type { z } from "zod";
import type { createPurchaseSchema, addPurchasePaymentSchema } from "./validators/supplier";
import { serialTransaction, BusinessError } from "./transaction";
import { receiveStock } from "./stock";
import { getMethodBalance } from "./payment-method-balance";
import { writeActivity } from "./activity-write";

const cents = (amount: number) => Math.round(amount * 100);
function statusFor(total: number, paid: number) {
  return paid >= total ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
}

export async function recordPurchase(
  db: PrismaClient,
  tenantId: string,
  actorId: string,
  input: z.infer<typeof createPurchaseSchema>
) {
  return serialTransaction(db, async (tx) => {
    if (!(await tx.supplier.findFirst({ where: { id: input.supplierId, tenantId } })))
      throw new BusinessError("That supplier is unavailable.");
    const ids = [...new Set(input.lines.map((line) => line.productId))];
    const products = await tx.product.findMany({
      where: { id: { in: ids }, tenantId, isActive: true },
    });
    if (products.length !== ids.length)
      throw new BusinessError("One or more products are unavailable or archived.");
    // Keep individual lines: duplicate products can have different receipt costs.
    const totalCents = input.lines.reduce(
      (sum, line) => sum + cents(line.unitCost) * line.quantity,
      0
    );
    if (!Number.isSafeInteger(totalCents) || totalCents > 999999999999)
      throw new BusinessError("Purchase total is too large.");
    const total = totalCents / 100;
    if (cents(input.amountPaid) > totalCents)
      throw new BusinessError("Amount paid cannot exceed the purchase total.");
    const paid = input.amountPaid;
    let methodName = "";
    if (paid > 0) {
      const method = await tx.paymentMethod.findFirst({
        where: { id: input.paymentMethodId || "", tenantId, isActive: true },
      });
      if (!method) throw new BusinessError("Choose an available payment method.");
      methodName = method.name;
      const balance = await getMethodBalance(tx, tenantId, method.id);
      if (cents(paid) > cents(balance))
        throw new BusinessError(`Not enough funds. ${balance.toFixed(2)} available.`);
    }
    const invoice = await tx.purchaseInvoice.create({
      data: {
        tenantId,
        supplierId: input.supplierId,
        reference: input.reference || null,
        invoiceDate: input.invoiceDate
          ? new Date(`${input.invoiceDate}T00:00:00+05:00`)
          : new Date(),
        total,
        status: statusFor(totalCents, cents(paid)),
        lines: { create: input.lines.map((line) => ({ ...line, tenantId })) },
      },
    });
    for (const line of input.lines) {
      const product = await tx.product.findFirstOrThrow({
        where: { id: line.productId, tenantId },
      });
      if (product.quantity + line.quantity > 2147483647)
        throw new BusinessError("Stock quantity is too large.");
      await tx.product.update({
        where: { id: line.productId, tenantId },
        data: {
          quantity: { increment: line.quantity },
          costPrice: line.unitCost,
          salePrice: line.unitSalePrice,
        },
      });
      await receiveStock(
        tx,
        tenantId,
        line.productId,
        line.quantity,
        line.unitCost,
        `PurchaseInvoice:${invoice.id}`
      );
      await tx.stockMovement.create({
        data: {
          tenantId,
          productId: line.productId,
          quantityDelta: line.quantity,
          type: "PURCHASE",
          reference: `PurchaseInvoice:${invoice.id}`,
        },
      });
    }
    if (paid > 0)
      await tx.purchasePayment.create({
        data: {
          tenantId,
          purchaseInvoiceId: invoice.id,
          amount: paid,
          paymentMethodId: input.paymentMethodId!,
        },
      });
    await writeActivity(
      tx,
      {
        tenantId,
        actorId,
        action: "PURCHASE_CREATE",
        meta: { total, amount: paid, ...(methodName ? { paymentMethod: methodName } : {}) },
      },
      invoice
    );
    return invoice;
  });
}

export async function payPurchase(
  db: PrismaClient,
  tenantId: string,
  actorId: string,
  input: z.infer<typeof addPurchasePaymentSchema>
) {
  return serialTransaction(db, async (tx) => {
    const invoice = await tx.purchaseInvoice.findFirst({
      where: { id: input.purchaseInvoiceId, tenantId },
      include: { payments: true },
    });
    if (!invoice) throw new BusinessError("Invoice not found.");
    const method = await tx.paymentMethod.findFirst({
      where: { id: input.paymentMethodId, tenantId, isActive: true },
    });
    if (!method) throw new BusinessError("That payment method is unavailable.");
    const total = cents(Number(invoice.total));
    const paid = invoice.payments.reduce((sum, row) => sum + cents(Number(row.amount)), 0);
    if (paid + cents(input.amount) > total)
      throw new BusinessError(`Only ${((total - paid) / 100).toFixed(2)} outstanding.`);
    const balance = await getMethodBalance(tx, tenantId, method.id);
    if (cents(input.amount) > cents(balance))
      throw new BusinessError(`Not enough funds. ${balance.toFixed(2)} available.`);
    await tx.purchasePayment.create({ data: { ...input, tenantId } });
    await tx.purchaseInvoice.update({
      where: { id: invoice.id, tenantId },
      data: { status: statusFor(total, paid + cents(input.amount)) },
    });
    await writeActivity(tx, {
      tenantId,
      actorId,
      action: "PURCHASE_PAYMENT",
      target: invoice.id,
      meta: { amount: input.amount, paymentMethod: method.name },
    });
  });
}
