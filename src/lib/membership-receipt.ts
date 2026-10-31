import type { Prisma } from "@/generated/prisma/client";
import type { InvoiceReceipt } from "@/app/app/invoices/invoice-receipt";
import { formatDate } from "./format";

/** Read the saved payment inside its transaction; never print an unsaved amount. */
export async function membershipReceipt(
  tx: Prisma.TransactionClient,
  tenantId: string,
  paymentId: string,
  heading?: "Membership receipt" | "Renewal receipt"
): Promise<InvoiceReceipt> {
  const payment = await tx.renewalPayment.findFirstOrThrow({
    where: { id: paymentId, tenantId },
    select: {
      id: true,
      kind: true,
      amount: true,
      recordedAt: true,
      periodStart: true,
      periodEnd: true,
      tenant: { select: { name: true, location: true } },
      paymentMethod: { select: { name: true } },
      membership: {
        select: {
          member: { select: { name: true, barcode: true } },
          package: { select: { name: true } },
        },
      },
    },
  });
  const amount = payment.amount.toString();
  const admission = payment.kind === "ADMISSION" || heading === "Membership receipt";
  return {
    heading: admission ? "Admission payment receipt" : "Renewal payment receipt",
    number: payment.id,
    businessName: payment.tenant.name,
    location: payment.tenant.location,
    customer: payment.membership.member.name,
    soldAt: payment.recordedAt.toISOString(),
    paymentMethod: payment.paymentMethod.name,
    details: [
      { label: "Member ID", value: payment.membership.member.barcode },
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
