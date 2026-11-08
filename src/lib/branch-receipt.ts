import type { Prisma } from "@/generated/prisma/client";
import { BusinessError } from "./transaction";

/** Legacy workspaces sometimes store the gym brand as name and branch as location. */
export function receiptBranchName(name: string, location: string) {
  const branded = ["goldsgym", "goldengym"].includes(name.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const branch = (branded ? location : name).trim() || "Main Branch";
  return /\bbranch\b/i.test(branch) ? branch : `${branch} Branch`;
}

/** Exactly three letters; collisions advance to another unused three-letter code. */
export function branchReceiptPrefix(branchName: string, used: Iterable<string>) {
  const words = branchName.toUpperCase().match(/[A-Z]+/g) ?? [];
  const preferred = (
    words.length >= 3 ? words.slice(0, 3).map((word) => word[0]).join("")
      : words.length === 2 ? words[0][0] + words[1].slice(0, 2)
        : words[0]?.slice(0, 3) ?? "BRN"
  ).padEnd(3, "X");
  const taken = new Set(used);
  const initial = [...preferred].reduce((number, letter) => number * 26 + letter.charCodeAt(0) - 65, 0);
  for (let offset = 0; offset < 26 ** 3; offset++) {
    const number = (initial + offset) % (26 ** 3);
    const candidate = String.fromCharCode(65 + Math.floor(number / 676), 65 + Math.floor(number / 26) % 26, 65 + number % 26);
    if (!taken.has(candidate)) return candidate;
  }
  throw new BusinessError("No branch receipt prefixes are available.");
}

/** Must run in the payment's serial transaction: prefix and counter roll back together. */
export async function nextMembershipReceiptNumber(tx: Prisma.TransactionClient, tenantId: string) {
  const branch = await tx.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { name: true, location: true, receiptPrefix: true },
  });
  let prefix = branch.receiptPrefix;
  if (!prefix) {
    const allocated = await tx.tenant.findMany({
      where: { receiptPrefix: { not: null } }, select: { receiptPrefix: true },
    });
    prefix = branchReceiptPrefix(receiptBranchName(branch.name, branch.location), allocated.map((row) => row.receiptPrefix!));
  }
  const updated = await tx.tenant.update({
    where: { id: tenantId },
    data: { receiptPrefix: prefix, receiptSequence: { increment: 1 } },
    select: { receiptSequence: true },
  });
  return `${prefix}${String(updated.receiptSequence).padStart(4, "0")}`;
}
