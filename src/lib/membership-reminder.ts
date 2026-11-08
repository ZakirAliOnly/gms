import type { PrismaClient } from "@/generated/prisma/client";
import { receiptBranchName } from "./branch-receipt";
import { renewalWhatsAppDraft } from "./whatsapp";

/** Read current dates/fees at click time; never trust a stale table row or caller-supplied fee. */
export async function membershipReminder(
  db: Pick<PrismaClient, "membership">,
  tenantId: string,
  membershipId: string
) {
  const membership = await db.membership.findFirst({
    where: { id: membershipId, tenantId },
    select: {
      status: true,
      nextRenewalDate: true,
      tenant: { select: { name: true, location: true } },
      member: { select: { name: true, phone: true, barcode: true } },
      package: { select: { name: true, price: true } },
      extras: { select: { fee: true } },
    },
  });
  if (!membership) return { error: "Membership not found." };
  if (membership.status === "CANCELLED")
    return { error: "Cancelled memberships do not receive renewal reminders." };
  const fee = membership.extras.reduce(
    (total, extra) => total.add(extra.fee),
    membership.package.price
  );
  return {
    draft: renewalWhatsAppDraft({
      branchName: receiptBranchName(membership.tenant.name, membership.tenant.location),
      member: membership.member,
      packageName: membership.package.name,
      fee: fee.toString(),
      renewalDate: membership.nextRenewalDate,
    }),
  };
}
