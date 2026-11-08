import type { Prisma } from "@/generated/prisma/client";
import type { InvoiceReceipt } from "@/app/app/invoices/invoice-receipt";
import { paymentWhatsAppDraft } from "./whatsapp";
import { GYM_NAME } from "./branding";
import { nextMembershipReceiptNumber, receiptBranchName } from "./branch-receipt";
import { formatDate } from "./format";

/** Read the saved payment inside its transaction; never print an unsaved amount. */
export async function membershipReceipt(
  tx: Prisma.TransactionClient,
  tenantId: string,
  paymentId: string,
  options: { printedBy: string; heading?: "Membership receipt" | "Renewal receipt" }
): Promise<InvoiceReceipt> {
  const payment = await tx.renewalPayment.findFirstOrThrow({
    where: { id: paymentId, tenantId },
    select: {
      id: true,
      kind: true,
      receiptNumber: true,
      amount: true,
      recordedAt: true,
      periodStart: true,
      periodEnd: true,
      tenant: { select: { name: true, location: true } },
      paymentMethod: { select: { name: true } },
      membership: {
        select: {
          member: { select: { name: true, barcode: true, phone: true } },
          package: { select: { name: true } },
        },
      },
    },
  });
  let receiptNumber = payment.receiptNumber;
  if (!receiptNumber) {
    receiptNumber = await nextMembershipReceiptNumber(tx, tenantId);
    await tx.renewalPayment.update({
      where: { id: payment.id, tenantId },
      data: { receiptNumber },
    });
  }
  const amount = payment.amount.toString();
  const admission = payment.kind === "ADMISSION" || options.heading === "Membership receipt";
  return {
    whatsapp: paymentWhatsAppDraft({
      branchName: receiptBranchName(payment.tenant.name, payment.tenant.location),
      kind: admission ? "ADMISSION" : "RENEWAL",
      number: receiptNumber,
      member: payment.membership.member,
      packageName: payment.membership.package.name,
      amount,
      method: payment.paymentMethod.name,
      paidAt: payment.recordedAt,
      periodStart: payment.periodStart,
      nextRenewal: payment.periodEnd,
      preparedBy: options.printedBy,
    }),
    heading: admission ? "Admission payment receipt" : "Renewal payment receipt",
    number: receiptNumber,
    businessName: GYM_NAME,
    branchName: receiptBranchName(payment.tenant.name, payment.tenant.location),
    branded: true,
    memberBarcode: payment.membership.member.barcode,
    printedBy: options.printedBy,
    printedAt: new Date().toISOString(),
    location: null,
    customer: payment.membership.member.name,
    soldAt: payment.recordedAt.toISOString(),
    paymentMethod: payment.paymentMethod.name,
    details: [
      { label: "Member barcode", value: payment.membership.member.barcode },
      { label: "Package", value: payment.membership.package.name },
      { label: "Period start", value: formatDate(payment.periodStart) },
      { label: "Next renewal", value: formatDate(payment.periodEnd) },
    ],
    paymentOnly: true,
    subtotal: amount,
    discount: "0",
    total: amount,
    lines: [
      {
        name: admission ? "Admission payment" : "Renewal payment",
        quantity: 1,
        unitPrice: amount,
        total: amount,
      },
    ],
  };
}
