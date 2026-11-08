import type { PrismaClient } from "@/generated/prisma/client";
import { startOfToday } from "./dates";
import { receiptBranchName } from "./branch-receipt";

const memberSelect = {
  id: true,
  name: true,
  barcode: true,
  phone: true,
  email: true,
  cnic: true,
  photoUrl: true,
  joinDate: true,
  tenant: { select: { name: true, location: true } },
  membership: {
    select: {
      id: true,
      status: true,
      startDate: true,
      nextRenewalDate: true,
      package: { select: { name: true, price: true } },
      extras: { select: { fee: true, extra: { select: { name: true } } } },
    },
  },
} as const;
const paymentSelect = {
  id: true,
  receiptNumber: true,
  kind: true,
  amount: true,
  recordedAt: true,
  periodStart: true,
  periodEnd: true,
  paymentMethod: { select: { name: true } },
} as const;
export const SCANNER_PAYMENT_PAGE_SIZE = 20;
type ScannerDb = Pick<PrismaClient, "member" | "renewalPayment">;

export async function memberScannerRecord(
  db: ScannerDb,
  tenantId: string,
  lookup: { barcode: string } | { memberId: string },
  requestedPage = 1,
  allPayments = false
) {
  if (!tenantId) throw new Error("Branch scope required.");
  const where =
    "barcode" in lookup
      ? { tenantId, barcode: lookup.barcode.trim() }
      : { tenantId, id: lookup.memberId };
  const member = await db.member.findFirst({ where, select: memberSelect });
  if (!member) return null;
  const membership = member.membership;
  const paymentWhere = { tenantId, membershipId: membership?.id ?? "" };
  const totals = membership
    ? await db.renewalPayment.aggregate({
        where: paymentWhere,
        _count: true,
        _sum: { amount: true },
      })
    : null;
  const totalCount = totals?._count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / SCANNER_PAYMENT_PAGE_SIZE));
  const page = Math.min(
    Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1),
    pageCount
  );
  const payments = membership
    ? await db.renewalPayment.findMany({
        where: paymentWhere,
        orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
        select: paymentSelect,
        ...(allPayments
          ? {}
          : { skip: (page - 1) * SCANNER_PAYMENT_PAGE_SIZE, take: SCANNER_PAYMENT_PAGE_SIZE }),
      })
    : [];
  return {
    profile: {
      id: member.id,
      name: member.name,
      barcode: member.barcode,
      phone: member.phone,
      email: member.email,
      cnic: member.cnic,
      photoUrl: member.photoUrl,
      joinedAt: member.joinDate.toISOString(),
      branchName: receiptBranchName(member.tenant.name, member.tenant.location),
      membership: membership
        ? {
            status: membership.status,
            startDate: membership.startDate.toISOString(),
            nextRenewalDate: membership.nextRenewalDate.toISOString(),
            packageName: membership.package.name,
            renewalFee: membership.extras
              .reduce((sum, item) => sum.add(item.fee), membership.package.price)
              .toString(),
            extras: membership.extras.map((item) => ({
              name: item.extra.name,
              fee: item.fee.toString(),
            })),
          }
        : null,
    },
    payments: payments.map((payment) => ({
      id: payment.id,
      number: payment.receiptNumber,
      kind: payment.kind,
      amount: payment.amount.toString(),
      date: payment.recordedAt.toISOString(),
      periodStart: payment.periodStart.toISOString(),
      periodEnd: payment.periodEnd.toISOString(),
      method: payment.paymentMethod.name,
    })),
    totalCount,
    totalPaid: totals?._sum.amount?.toString() ?? "0",
    page,
    pageCount,
  };
}
export type ScannerRecord = NonNullable<Awaited<ReturnType<typeof memberScannerRecord>>>;
export function scannerRenewalStatus(profile: ScannerRecord["profile"], now = new Date()) {
  const membership = profile.membership;
  if (!membership)
    return { label: "No membership", detail: "No membership is recorded.", pending: false };
  if (membership.status === "CANCELLED")
    return { label: "Cancelled", detail: "Membership is cancelled.", pending: false };
  const days = Math.round(
    (startOfToday(new Date(membership.nextRenewalDate)).getTime() - startOfToday(now).getTime()) /
      86400000
  );
  if (days < 0)
    return {
      label: "Overdue",
      detail: `Renewal pending — ${Math.abs(days)} day${days === -1 ? "" : "s"} overdue.`,
      pending: true,
    };
  if (membership.status === "EXPIRED")
    return {
      label: "Expired",
      detail: "Membership is marked expired; renewal is pending.",
      pending: true,
    };
  if (days === 0)
    return { label: "Due today", detail: "Membership renewal is due today.", pending: true };
  return {
    label: days < 7 ? "Upcoming renewal" : "Active",
    detail: `Next renewal in ${days} day${days === 1 ? "" : "s"}.`,
    pending: false,
  };
}
