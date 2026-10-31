import type { Prisma, PrismaClient } from "@/generated/prisma/client";

export class BusinessError extends Error {}

/** Retry the entire read/check/write operation, never just its writes. */
export async function serialTransaction<T>(
  db: PrismaClient,
  work: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(work, { isolationLevel: "Serializable", timeout: 15000 });
    } catch (error) {
      const retry =
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error.code === "P2034" || error.code === "P2002");
      if (!retry) throw error;
      if (attempt === 2) throw new BusinessError("Data changed while saving. Please try again.");
    }
  }
}
