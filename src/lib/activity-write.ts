import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { serialTransaction } from "./transaction";

export type ActivityContext = {
  actorId: string;
  tenantId: string;
  action: string;
  target?: string;
  meta?: Prisma.InputJsonObject;
};

/** Deliberately allowlisted: never copy contact details, photos, or credentials. */
export async function writeActivity(
  tx: Pick<Prisma.TransactionClient, "auditLog"> &
    Partial<Pick<Prisma.TransactionClient, "paymentMethod">>,
  context: ActivityContext,
  result?: unknown
) {
  const record = result && typeof result === "object" ? (result as Record<string, unknown>) : {};
  const meta: Record<string, string | number | boolean> = {};
  for (const key of [
    "name",
    "number",
    "amount",
    "total",
    "price",
    "fee",
    "isActive",
    "customer",
    "paymentMethod",
    "status",
  ]) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
      meta[key] = value;
    else if (value && typeof value === "object" && "toFixed" in value) meta[key] = String(value);
  }
  if (typeof record.paymentMethodId === "string" && tx.paymentMethod) {
    const method = await tx.paymentMethod.findFirst({
      where: { id: record.paymentMethodId, tenantId: context.tenantId },
      select: { name: true },
    });
    if (method?.name) meta.paymentMethod = method.name;
  }
  await tx.auditLog.create({
    data: {
      actorId: context.actorId,
      tenantId: context.tenantId,
      action: context.action,
      target:
        context.target ??
        (typeof record.id === "string"
          ? record.id
          : typeof record.number === "string"
            ? record.number
            : context.tenantId),
      meta: { ...meta, ...context.meta },
    },
  });
}

/** The business change and its activity entry either both commit or both roll back. */
export async function activityTransaction<T>(
  db: PrismaClient,
  context: ActivityContext,
  work: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return serialTransaction(db, async (tx) => {
    const result = await work(tx);
    await writeActivity(tx, context, result);
    return result;
  });
}
