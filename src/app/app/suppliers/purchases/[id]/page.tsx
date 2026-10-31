import { notFound } from "next/navigation";
import Link from "@/components/workspace-link";
import { tenantDb } from "@/lib/tenant-db";
import { formatDate, formatMoneyPrecise } from "@/lib/format";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Purchase receipt" };
export default async function PurchaseReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, tenantId } = await tenantDb();
  const { id } = await params;
  const receipt = await db.purchaseInvoice.findFirst({
    where: { id, tenantId },
    include: {
      supplier: true,
      lines: { include: { product: true } },
      payments: { include: { paymentMethod: true }, orderBy: { paidAt: "asc" } },
    },
  });
  if (!receipt) notFound();
  const paid = receipt.payments.reduce((n, p) => n + Number(p.amount), 0);
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-8">
      <Link href="/app/suppliers" className="text-primary text-sm underline">
        Back to suppliers
      </Link>
      <div className="mt-4">
        <PageHeader
          eyebrow={receipt.supplier.name}
          title={receipt.reference || "Purchase receipt"}
          description={`${formatDate(receipt.invoiceDate)} · ${receipt.status}`}
        />
      </div>
      <p className="mt-4 text-sm">
        Received stock is available for sales. Paying this receipt changes the supplier balance and
        does not receive stock again.
      </p>
      <div className="border-border mt-4 overflow-x-auto rounded border">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary">
            <tr>
              {["Product", "Received", "Unit cost", "Sale price", "Line total"].map((h) => (
                <th key={h} className="px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {receipt.lines.map((line) => (
              <tr key={line.id} className="border-border border-t">
                <td className="px-4 py-3">
                  <Link
                    href={`/app/inventory/${line.productId}`}
                    className="text-primary underline"
                  >
                    {line.product.name}
                  </Link>
                </td>
                <td className="px-4 py-3">{line.quantity}</td>
                <td className="px-4 py-3">{formatMoneyPrecise(line.unitCost)}</td>
                <td className="px-4 py-3">{formatMoneyPrecise(line.unitSalePrice)}</td>
                <td className="px-4 py-3">
                  {formatMoneyPrecise(Number(line.unitCost) * line.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm">
        Total: {formatMoneyPrecise(receipt.total)} · Paid: {formatMoneyPrecise(paid)} · Outstanding:{" "}
        {formatMoneyPrecise(Number(receipt.total) - paid)}
      </p>
      <h2 className="mt-8 text-lg font-semibold">Payments</h2>
      {receipt.payments.map((payment) => (
        <p key={payment.id} className="mt-2 text-sm">
          {formatDate(payment.paidAt)} · {payment.paymentMethod.name} ·{" "}
          {formatMoneyPrecise(payment.amount)}
        </p>
      ))}
      {!receipt.payments.length && (
        <p className="text-muted-foreground mt-2 text-sm">No payments recorded.</p>
      )}
    </main>
  );
}
