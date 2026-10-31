import assert from "node:assert/strict";
import { test } from "node:test";
import type { Prisma } from "@/generated/prisma/client";
import { membershipReceipt } from "./membership-receipt";
import { invoiceDocument } from "@/app/app/invoices/invoice-receipt";

for (const heading of ["Membership receipt", "Renewal receipt"] as const) {
  test(`${heading} prints the saved payment and membership details`, async () => {
    const tx = {
      renewalPayment: {
        findFirstOrThrow: async ({ where }: { where: unknown }) => {
          assert.deepEqual(where, { id: "payment-123", tenantId: "tenant-1" });
          return {
            id: "payment-123",
            amount: { toString: () => "1250.50" },
            recordedAt: new Date("2026-09-29T10:00:00Z"),
            periodStart: new Date("2026-09-29T10:00:00Z"),
            periodEnd: new Date("2026-10-29T10:00:00Z"),
            tenant: { name: "Demo Gym", location: "Lahore" },
            paymentMethod: { name: "Cash" },
            membership: {
              member: { name: "Ali & Sons", barcode: "IR123456" },
              package: { name: "Monthly" },
            },
          };
        },
      },
    } as unknown as Prisma.TransactionClient;
    const receipt = await membershipReceipt(tx, "tenant-1", "payment-123", heading);
    assert.equal(receipt.total, "1250.50");
    assert.equal(receipt.lines[0].total, receipt.total);
    const html = invoiceDocument(receipt);
    for (const value of [
      heading === "Membership receipt" ? "Admission payment receipt" : "Renewal payment receipt",
      "payment-123",
      "IR123456",
      "Monthly",
      "29-Oct-2026",
      "Cash",
      "Ali &amp; Sons",
      "1,250.50",
      "width: 80mm",
      "Software Develop By: AddsMint.com",
    ]) {
      assert.ok(html.includes(value), `Missing ${value}`);
    }
    assert.ok(!html.includes("<dt>Discount</dt>"));
    assert.ok(!html.includes("<dt>Subtotal</dt>"));
  });
}
