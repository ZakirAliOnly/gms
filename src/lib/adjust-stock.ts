import type { PrismaClient } from "@/generated/prisma/client";
import { serialTransaction, BusinessError } from "./transaction";
import { receiveStock, consumeStock } from "./stock";
import { writeActivity } from "./activity-write";

export async function adjustInventory(
  db: PrismaClient,
  tenantId: string,
  actorId: string,
  id: string,
  delta: number,
  reason: string
) {
  return serialTransaction(db, async (tx) => {
    const product = await tx.product.findFirst({ where: { id, tenantId } });
    if (!product) throw new BusinessError("Product not found.");
    if (product.quantity + delta < 0) throw new BusinessError(`Only ${product.quantity} in stock.`);
    if (product.quantity + delta > 2147483647)
      throw new BusinessError("Stock quantity is too large.");
    if (delta > 0)
      await receiveStock(tx, tenantId, id, delta, product.costPrice, "ManualAdjustment");
    else await consumeStock(tx, tenantId, id, -delta);
    await tx.product.update({ where: { id, tenantId }, data: { quantity: { increment: delta } } });
    await tx.stockMovement.create({
      data: { tenantId, productId: id, quantityDelta: delta, type: "ADJUSTMENT", reason },
    });
    await writeActivity(tx, {
      tenantId,
      actorId,
      action: "STOCK_ADJUST",
      target: id,
      meta: { delta },
    });
  });
}
