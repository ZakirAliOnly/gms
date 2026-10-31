import Link from "@/components/workspace-link";
import { tenantDb } from "@/lib/tenant-db";
import { PageHeader } from "@/components/page-header";
import { PosTerminal } from "./pos-terminal";
import { InvoiceHistory } from "./invoice-history";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  const { db, tenantId } = await tenantDb("invoices");

  const [products, members, paymentMethods, invoices] = await Promise.all([
    db.product.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        serial: true,
        name: true,
        category: true,
        photoUrl: true,
        salePrice: true,
        quantity: true,
      },
    }),
    db.member.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, barcode: true },
    }),
    db.paymentMethod.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.retailInvoice.findMany({
      where: { tenantId },
      orderBy: [{ soldAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        number: true,
        soldAt: true,
        total: true,
        member: { select: { name: true } },
        paymentMethod: { select: { name: true } },
      },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Retail"
        title="New sale"
        description={invoices[0] ? `Last invoice ${invoices[0].number}` : "No sales recorded yet."}
      />

      {paymentMethods.length === 0 && (
        <p className="border-border bg-card text-muted-foreground mt-4 rounded border px-4 py-3 text-[13px]">
          Sales need a payment method.{" "}
          <Link href="/app/payment-methods" className="text-primary hover:underline">
            Add one
          </Link>{" "}
          to start recording.
        </p>
      )}

      <PosTerminal
        products={products.map((p) => ({ ...p, salePrice: p.salePrice.toString() }))}
        members={members}
        paymentMethods={paymentMethods}
      />
      <InvoiceHistory
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          salePrice: product.salePrice.toString(),
        }))}
        members={members}
        paymentMethods={paymentMethods}
        invoices={invoices.map((invoice) => ({
          id: invoice.id,
          number: invoice.number,
          soldAt: invoice.soldAt.toISOString(),
          total: invoice.total.toString(),
          customer: invoice.member?.name ?? "Walk-in customer",
          paymentMethod: invoice.paymentMethod.name,
        }))}
      />
    </main>
  );
}
