import type { PrismaClient } from "@/generated/prisma/client";
import type { CreateInvoiceInput } from "./validators/invoice";
import { serialTransaction, BusinessError } from "./transaction";
import { consumeStock, invoiceCost } from "./stock";
import { writeActivity } from "./activity-write";
/**
 * INV-000123, sequential per tenant.
 *
 * The highest number must be found NUMERICALLY, not by sorting text:
 * "INV-1002" sorts above "INV-000123" as a string, so a text sort keeps
 * handing back a number that already exists. Padding alone does not fix it
 * either, since older rows may carry a different width.
 */
function highestSequence(numbers: string[]): number {
  return numbers.reduce((max, value) => {
    const digits = Number.parseInt(value.replace(/[^0-9]/g, ""), 10);
    return Number.isNaN(digits) ? max : Math.max(max, digits);
  }, 0);
}

function formatNumber(sequence: number): string {
  return `INV-${String(sequence).padStart(6, "0")}`;
}

export async function recordSale(
  db: PrismaClient,
  tenantId: string,
  userId: string,
  input: CreateInvoiceInput
) {
  return serialTransaction(db, async (tx) => {
    const { lines, discount, paymentMethodId, memberId } = input;

    // Collapse duplicate lines so stock checks see the true total per product.
    const wanted = new Map<string, number>();
    for (const line of lines) {
      wanted.set(line.productId, (wanted.get(line.productId) ?? 0) + line.quantity);
    }

    const productIds = [...wanted.keys()];

    const [products, method, member, tenant] = await Promise.all([
      tx.product.findMany({
        where: { id: { in: productIds }, tenantId, isActive: true },
        select: { id: true, name: true, salePrice: true, quantity: true },
      }),
      tx.paymentMethod.findFirst({
        where: { id: paymentMethodId, tenantId, isActive: true },
        select: { id: true, name: true },
      }),
      memberId
        ? tx.member.findFirst({
            where: { id: memberId, tenantId },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
      tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { name: true, location: true },
      }),
    ]);

    if (!method) throw new BusinessError("That payment method is not available.");
    if (products.length !== productIds.length) {
      throw new BusinessError("One or more items are no longer available.");
    }
    if (memberId && !member) throw new BusinessError("That member was not found.");

    // Refuse to oversell rather than driving stock negative.
    for (const product of products) {
      const qty = wanted.get(product.id)!;
      if (product.quantity < qty) {
        throw new BusinessError(`Not enough stock for ${product.name} — ${product.quantity} left.`);
      }
    }

    const priced = products.map((product) => {
      const quantity = wanted.get(product.id)!;
      const unitPrice = Number(product.salePrice.toString());
      return {
        product,
        quantity,
        unitPrice,
        lineTotal: (Math.round(unitPrice * 100) * quantity) / 100,
      };
    });

    const subtotal = priced.reduce((sum, line) => sum + Math.round(line.lineTotal * 100), 0) / 100;
    if (!Number.isSafeInteger(Math.round(subtotal * 100)) || subtotal > 9999999999.99)
      throw new BusinessError("Invoice total is too large.");

    if (discount > subtotal) {
      throw new BusinessError("Discount cannot exceed the subtotal.");
    }

    const total = Math.round((subtotal - discount) * 100) / 100;

    const saved = await (async () => {
      // Every number is read and compared numerically. A `orderBy: number desc`
      // would sort as text and pick the wrong row - see highestSequence above.
      const existing = await tx.retailInvoice.findMany({
        where: { tenantId },
        select: { number: true },
      });
      // Deleting the most recent invoice must not reuse its printed number.
      const deleted = await tx.auditLog.findMany({
        where: { tenantId, action: "RETAIL_INVOICE_DELETE" },
        select: { meta: true },
      });
      const retiredNumbers = deleted.flatMap(({ meta }) =>
        meta && typeof meta === "object" && !Array.isArray(meta) && typeof meta.number === "string"
          ? [meta.number]
          : []
      );
      const number = formatNumber(
        highestSequence([...existing.map((row) => row.number), ...retiredNumbers]) + 1
      );

      const invoice = await tx.retailInvoice.create({
        data: {
          tenantId,
          number,
          memberId: member?.id ?? null,
          subtotal,
          discount,
          total,
          paymentMethodId,
          lines: {
            create: priced.map((line) => ({
              tenantId,
              productId: line.product.id,
              unitPrice: line.unitPrice,
              quantity: line.quantity,
              lineTotal: line.lineTotal,
            })),
          },
        },
        select: {
          id: true,
          number: true,
          soldAt: true,
          subtotal: true,
          discount: true,
          total: true,
          lines: { select: { productId: true, quantity: true, unitPrice: true, lineTotal: true } },
        },
      });

      for (const line of priced) {
        await consumeStock(tx, tenantId, line.product.id, line.quantity, invoice.id);
        const costTotal = await invoiceCost(
          tx,
          tenantId,
          invoice.id,
          line.product.id,
          line.quantity
        );
        await tx.retailInvoiceLine.updateMany({
          where: { invoiceId: invoice.id, productId: line.product.id, tenantId },
          data: { costTotal },
        });
        await tx.product.update({
          where: { id: line.product.id, tenantId },
          data: { quantity: { decrement: line.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            tenantId,
            productId: line.product.id,
            quantityDelta: -line.quantity,
            type: "SALE",
            reference: `RetailInvoice:${invoice.id}`,
          },
        });
      }

      return invoice;
    })();
    await writeActivity(
      tx,
      {
        tenantId,
        actorId: userId,
        action: "RETAIL_INVOICE_CREATE",
        meta: { paymentMethod: method.name, status: "Paid" },
      },
      saved
    );

    return { saved, products, member, method, tenant };
  });
}
