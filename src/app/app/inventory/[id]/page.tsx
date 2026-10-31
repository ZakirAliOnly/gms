import { notFound } from "next/navigation";
import Link from "@/components/workspace-link";
import { tenantDb } from "@/lib/tenant-db";
import { formatDate, formatMoneyPrecise } from "@/lib/format";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Stock history" };
export default async function StockHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, tenantId } = await tenantDb("inventory");
  const { id } = await params;
  const product = await db.product.findFirst({ where: { id, tenantId } });
  if (!product) notFound();
  const [lots, movements] = await Promise.all([
    db.stockLot.findMany({
      where: { tenantId, productId: id },
      orderBy: [{ receivedAt: "asc" }, { sequence: "asc" }],
    }),
    db.stockMovement.findMany({
      where: { tenantId, productId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
  ]);
  const value = lots.reduce((sum, lot) => sum + lot.remaining * Number(lot.unitCost), 0);
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-8">
      <Link href="/app/inventory" className="text-primary text-sm underline">
        Back to inventory
      </Link>
      <div className="mt-4">
        <PageHeader
          eyebrow="Inventory"
          title={product.name}
          description={`${product.quantity} on hand · FIFO value ${formatMoneyPrecise(value)}`}
        />
      </div>
      <h2 className="mt-6 text-lg font-semibold">FIFO receipt lots</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Oldest receipts are consumed first. Opening balances, manual corrections and pre-FIFO
        returns use estimated recorded costs.
      </p>
      <div className="border-border mt-3 overflow-x-auto rounded border">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary">
            <tr>
              {[
                "Received",
                "Source",
                "Quantity received",
                "Remaining",
                "Unit cost",
                "Remaining value",
              ].map((h) => (
                <th key={h} className="px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => (
              <tr key={lot.id} className="border-border border-t">
                <td className="px-4 py-3">{formatDate(lot.receivedAt)}</td>
                <td className="px-4 py-3">
                  {lot.source.startsWith("PurchaseInvoice:") ? (
                    <Link
                      href={`/app/suppliers/purchases/${lot.source.slice(16)}`}
                      className="text-primary underline"
                    >
                      Supplier receipt
                    </Link>
                  ) : (
                    lot.source
                  )}
                </td>
                <td className="px-4 py-3">{lot.quantity}</td>
                <td className="px-4 py-3">{lot.remaining}</td>
                <td className="px-4 py-3">{formatMoneyPrecise(lot.unitCost)}</td>
                <td className="px-4 py-3">
                  {formatMoneyPrecise(lot.remaining * Number(lot.unitCost))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mt-8 text-lg font-semibold">Stock movements</h2>
      <div className="border-border mt-3 overflow-x-auto rounded border">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary">
            <tr>
              {["Date", "Type", "Change", "Document", "Reason"].map((h) => (
                <th key={h} className="px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id} className="border-border border-t">
                <td className="px-4 py-3">{formatDate(m.createdAt)}</td>
                <td className="px-4 py-3">{m.type}</td>
                <td className="px-4 py-3">{m.quantityDelta}</td>
                <td className="px-4 py-3">{m.reference || "Manual"}</td>
                <td className="px-4 py-3">{m.reason || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
