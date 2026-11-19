import type { Prisma } from "@/generated/prisma/client";

export async function lockerConflictErrors(
  db: Pick<Prisma.TransactionClient, "membershipExtra">,
  tenantId: string,
  numbers: Record<string, string>,
  excludeMembershipId?: string
) {
  const values = Object.values(numbers);
  if (!values.length) return {};
  const assigned = await db.membershipExtra.findMany({
    where: {
      tenantId,
      lockerNumber: { in: values },
      ...(excludeMembershipId ? { membershipId: { not: excludeMembershipId } } : {}),
    },
    select: { lockerNumber: true },
  });
  const used = new Set(assigned.map((row) => row.lockerNumber));
  return Object.fromEntries(
    Object.entries(numbers)
      .filter(([, value]) => used.has(value))
      .map(([id, value]) => [
        `lockerNumber:${id}`,
        `Locker ${value} is already assigned in this branch.`,
      ])
  );
}
