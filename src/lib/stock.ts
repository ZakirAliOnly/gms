import type { Prisma } from "@/generated/prisma/client";
import { BusinessError } from "./transaction";

type Tx = Prisma.TransactionClient;

/** Receipts retain their own cost even when the catalogue cost changes later. */
export async function receiveStock(
  tx: Tx,
  tenantId: string,
  productId: string,
  quantity: number,
  unitCost: Prisma.Decimal | number,
  source: string
) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0)
    throw new BusinessError("Invalid receipt quantity.");
  await tx.stockLot.create({
    data: { tenantId, productId, quantity, remaining: quantity, unitCost, source },
  });
}

/** Called inside a serializable transaction alongside the quantity/movement writes. */
export async function consumeStock(
  tx: Tx,
  tenantId: string,
  productId: string,
  quantity: number,
  invoiceId?: string
) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0)
    throw new BusinessError("Invalid stock quantity.");
  const lots = await tx.stockLot.findMany({
    where: { tenantId, productId, remaining: { gt: 0 } },
    orderBy: [{ receivedAt: "asc" }, { sequence: "asc" }],
  });
  let needed = quantity;
  for (const lot of lots) {
    const taken = Math.min(needed, lot.remaining);
    await tx.stockLot.update({
      where: { id: lot.id, tenantId },
      data: { remaining: { decrement: taken } },
    });
    if (invoiceId)
      await tx.stockAllocation.create({
        data: { tenantId, invoiceId, lotId: lot.id, quantity: taken },
      });
    needed -= taken;
    if (!needed) return;
  }
  throw new BusinessError("Insufficient FIFO stock. Refresh inventory before trying again.");
}

/** Undo the newest allocations first, preserving the oldest consumed units. */
export async function restoreStock(
  tx: Tx,
  tenantId: string,
  productId: string,
  quantity: number,
  invoiceId: string
) {
  const allocations = await tx.stockAllocation.findMany({
    where: { tenantId, invoiceId, lot: { productId, tenantId } },
    include: { lot: true },
    orderBy: [{ lot: { receivedAt: "desc" } }, { lot: { sequence: "desc" } }, { id: "desc" }],
  });
  let needed = quantity;
  for (const allocation of allocations) {
    const returned = Math.min(needed, allocation.quantity);
    await tx.stockLot.update({
      where: { id: allocation.lotId, tenantId },
      data: { remaining: { increment: returned } },
    });
    if (returned === allocation.quantity)
      await tx.stockAllocation.delete({ where: { id: allocation.id } });
    else
      await tx.stockAllocation.update({
        where: { id: allocation.id },
        data: { quantity: { decrement: returned } },
      });
    needed -= returned;
    if (!needed) return;
  }
  // Pre-FIFO invoices have no historical allocations. Mark the estimated cost;
  // never pretend it is an original purchase cost.
  const product = await tx.product.findFirstOrThrow({ where: { id: productId, tenantId } });
  await receiveStock(
    tx,
    tenantId,
    productId,
    needed,
    product.costPrice,
    `LegacyReturn:${invoiceId}`
  );
}

export async function invoiceCost(
  tx: Tx,
  tenantId: string,
  invoiceId: string,
  productId: string,
  quantity: number
) {
  const allocations = await tx.stockAllocation.findMany({
    where: { tenantId, invoiceId, lot: { productId, tenantId } },
    include: { lot: true },
  });
  if (allocations.reduce((n, row) => n + row.quantity, 0) !== quantity) return null;
  const costCents = allocations.reduce(
    (n, row) => n + Math.round(Number(row.lot.unitCost) * 100) * row.quantity,
    0
  );
  if (!Number.isSafeInteger(costCents) || costCents > 999999999999)
    throw new BusinessError("Allocated stock cost is too large for this invoice.");
  return costCents / 100;
}
