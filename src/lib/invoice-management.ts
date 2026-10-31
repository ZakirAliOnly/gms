import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { InvoiceReceipt } from "@/app/app/invoices/invoice-receipt";
import type { CreateInvoiceInput } from "./validators/invoice";
import { getMethodBalance } from "./payment-method-balance";
import { consumeStock, restoreStock, invoiceCost } from "./stock";
import { BusinessError } from "./transaction";

const invoiceInclude = {
  tenant: { select: { name: true, location: true } },
  member: { select: { name: true } },
  paymentMethod: { select: { name: true } },
  lines: { include: { product: { select: { name: true } } }, orderBy: { id: "asc" as const } },
} satisfies Prisma.RetailInvoiceInclude;
type StoredInvoice = Prisma.RetailInvoiceGetPayload<{ include: typeof invoiceInclude }>;

export type EditableInvoice = {
  id: string;
  version: string;
  number: string;
  memberId: string | null;
  paymentMethodId: string;
  discount: string;
  lines: { productId: string; name: string; quantity: number; unitPrice: string }[];
  receipt: InvoiceReceipt;
};

function versionOf(invoice: StoredInvoice) {
  // Detect stale forms without a schema migration. Product names/prices can
  // change independently; only the saved invoice participates in this version.
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: invoice.id,
        memberId: invoice.memberId,
        method: invoice.paymentMethodId,
        discount: invoice.discount.toString(),
        total: invoice.total.toString(),
        lines: invoice.lines.map((line) => [
          line.id,
          line.productId,
          line.quantity,
          line.unitPrice.toString(),
        ]),
      })
    )
    .digest("hex");
}

function serialize(invoice: StoredInvoice): EditableInvoice {
  return {
    id: invoice.id,
    version: versionOf(invoice),
    number: invoice.number,
    memberId: invoice.memberId,
    paymentMethodId: invoice.paymentMethodId,
    discount: invoice.discount.toString(),
    lines: invoice.lines.map((line) => ({
      productId: line.productId,
      name: line.product.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice.toString(),
    })),
    receipt: {
      number: invoice.number,
      soldAt: invoice.soldAt.toISOString(),
      businessName: invoice.tenant.name,
      location: invoice.tenant.location,
      customer: invoice.member?.name ?? "Walk-in customer",
      paymentMethod: invoice.paymentMethod.name,
      subtotal: invoice.subtotal.toString(),
      discount: invoice.discount.toString(),
      total: invoice.total.toString(),
      lines: invoice.lines.map((line) => ({
        name: line.product.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice.toString(),
        total: line.lineTotal.toString(),
      })),
    },
  };
}

export async function readInvoice(db: PrismaClient, tenantId: string, id: string) {
  const invoice = await db.retailInvoice.findFirst({
    where: { id, tenantId },
    include: invoiceInclude,
  });
  return invoice ? serialize(invoice) : null;
}

type OriginalLine = { productId: string; quantity: number; unitPrice: { toString(): string } };
type Product = {
  id: string;
  name: string;
  quantity: number;
  isActive: boolean;
  salePrice: { toString(): string };
};

/** Preserve existing price snapshots; apply only the quantity difference to stock. */
export function planInvoiceChange(
  old: OriginalLine[],
  products: Product[],
  input: CreateInvoiceInput | null
) {
  const previous = new Map<string, { quantity: number; unitPrice: number }>();
  for (const line of old) {
    const quantity = (previous.get(line.productId)?.quantity ?? 0) + line.quantity;
    previous.set(line.productId, {
      quantity,
      unitPrice: Math.round(Number(line.unitPrice.toString()) * 100),
    });
  }
  const wanted = new Map<string, number>();
  for (const line of input?.lines ?? [])
    wanted.set(line.productId, (wanted.get(line.productId) ?? 0) + line.quantity);
  const catalog = new Map(products.map((product) => [product.id, product]));
  const lines: { productId: string; quantity: number; unitPrice: number; lineTotal: number }[] = [];
  const movements: { productId: string; delta: number }[] = [];
  let subtotalCents = 0;
  for (const id of new Set([...previous.keys(), ...wanted.keys()])) {
    const product = catalog.get(id);
    if (!product) throw new InvoiceChangeError("One of the products is unavailable.");
    const before = previous.get(id)?.quantity ?? 0;
    const quantity = wanted.get(id) ?? 0;
    if (!product.isActive && quantity > before)
      throw new InvoiceChangeError(
        `${product.name} is archived. Its quantity cannot be increased.`
      );
    const delta = before - quantity;
    if (product.quantity + delta < 0)
      throw new InvoiceChangeError(
        `Not enough stock for ${product.name}. ${product.quantity + before} available for this invoice.`
      );
    if (delta !== 0) movements.push({ productId: id, delta });
    if (quantity) {
      const unitCents =
        previous.get(id)?.unitPrice ?? Math.round(Number(product.salePrice.toString()) * 100);
      const lineCents = unitCents * quantity;
      subtotalCents += lineCents;
      lines.push({
        productId: id,
        quantity,
        unitPrice: unitCents / 100,
        lineTotal: lineCents / 100,
      });
    }
  }
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents > 999_999_999_999)
    throw new InvoiceChangeError("Invoice total is too large.");
  const discountCents = Math.round((input?.discount ?? 0) * 100);
  if (discountCents > subtotalCents)
    throw new InvoiceChangeError("Discount cannot exceed the subtotal.");
  return {
    lines,
    movements,
    subtotal: subtotalCents / 100,
    total: (subtotalCents - discountCents) / 100,
  };
}

class InvoiceChangeError extends Error {}
export type InvoiceChangeResult = { ok: true } | { error: string };

export async function changeInvoice(
  db: PrismaClient,
  tenantId: string,
  actorId: string,
  id: string,
  version: string,
  input: CreateInvoiceInput | null
): Promise<InvoiceChangeResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const invoice = await tx.retailInvoice.findFirst({
            where: { id, tenantId },
            include: invoiceInclude,
          });
          if (!invoice) throw new InvoiceChangeError("Invoice not found. Refresh the history.");
          if (versionOf(invoice) !== version)
            throw new InvoiceChangeError(
              "This invoice has changed. Close this window and reopen it before trying again."
            );
          if (input) {
            const method = await tx.paymentMethod.findFirst({
              where: { id: input.paymentMethodId, tenantId },
            });
            if (!method || (!method.isActive && method.id !== invoice.paymentMethodId))
              throw new InvoiceChangeError("That payment method is unavailable.");
            if (
              input.memberId &&
              !(await tx.member.findFirst({
                where: { id: input.memberId, tenantId },
                select: { id: true },
              }))
            )
              throw new InvoiceChangeError("That member is unavailable.");
          }
          const ids = [
            ...new Set([
              ...invoice.lines.map((line) => line.productId),
              ...(input?.lines.map((line) => line.productId) ?? []),
            ]),
          ];
          const products = await tx.product.findMany({
            where: { tenantId, id: { in: ids } },
            select: { id: true, name: true, quantity: true, isActive: true, salePrice: true },
          });
          const plan = planInvoiceChange(invoice.lines, products, input);

          // Removing or reducing an income entry must not spend money twice.
          const retainedCredit =
            input?.paymentMethodId === invoice.paymentMethodId ? plan.total : 0;
          const reduction =
            Math.round(Number(invoice.total.toString()) * 100) - Math.round(retainedCredit * 100);
          if (reduction > 0) {
            const balance = await getMethodBalance(tx, tenantId, invoice.paymentMethodId);
            if (reduction > Math.round(balance * 100))
              throw new InvoiceChangeError(
                `Cannot reverse this payment: only ${balance.toFixed(2)} remains in ${invoice.paymentMethod.name}.`
              );
          }

          for (const movement of plan.movements) {
            if (movement.delta < 0)
              await consumeStock(tx, tenantId, movement.productId, -movement.delta, id);
            else await restoreStock(tx, tenantId, movement.productId, movement.delta, id);
            await tx.product.update({
              where: { id: movement.productId, tenantId },
              data: { quantity: { increment: movement.delta } },
            });
            await tx.stockMovement.create({
              data: {
                tenantId,
                productId: movement.productId,
                quantityDelta: movement.delta,
                type: "ADJUSTMENT",
                reference: `RetailInvoice:${id}`,
                reason: `${input ? "Edited" : "Deleted"} invoice ${invoice.number}`,
              },
            });
          }
          if (input) {
            const costedLines = await Promise.all(
              plan.lines.map(async (line) => ({
                ...line,
                tenantId,
                costTotal: await invoiceCost(tx, tenantId, id, line.productId, line.quantity),
              }))
            );
            await tx.retailInvoiceLine.deleteMany({ where: { invoiceId: id, tenantId } });
            await tx.retailInvoice.update({
              where: { id, tenantId },
              data: {
                memberId: input.memberId || null,
                paymentMethodId: input.paymentMethodId,
                subtotal: plan.subtotal,
                discount: input.discount,
                total: plan.total,
                lines: { create: costedLines },
              },
            });
          } else {
            await tx.retailInvoice.delete({ where: { id, tenantId } });
          }
          await tx.auditLog.create({
            data: {
              tenantId,
              actorId,
              action: input ? "RETAIL_INVOICE_EDIT" : "RETAIL_INVOICE_DELETE",
              target: id,
              meta: {
                number: invoice.number,
                previousTotal: invoice.total.toString(),
                total: input ? String(plan.total) : null,
              },
            },
          });
          return { ok: true } as const;
        },
        { isolationLevel: "Serializable" }
      );
    } catch (error) {
      if (error instanceof InvoiceChangeError || error instanceof BusinessError)
        return { error: error.message };
      if (!(error && typeof error === "object" && "code" in error && error.code === "P2034"))
        throw error;
    }
  }
  return { error: "The invoice or stock changed while saving. Please try again." };
}
