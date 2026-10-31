import { Truck } from "lucide-react";
import Link from "@/components/workspace-link";
import { getTenantContext } from "@/lib/tenant-context";
import { formatDate, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { getPurchaseFormData, getPurchases, getSuppliers } from "./data";
import { AddSupplierDialog, EditSupplierDialog } from "./supplier-dialogs";
import { PurchaseDialog } from "./purchase-dialog";
import { PayInvoiceDialog } from "./pay-invoice-dialog";

export const metadata = { title: "Suppliers" };

const STATUS_STYLES = {
  UNPAID: "bg-destructive/10 text-destructive",
  PARTIAL: "bg-warning/10 text-warning",
  PAID: "bg-success/10 text-success",
} as const;

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await getTenantContext();
  const sp = await searchParams;
  const [suppliers, formData] = await Promise.all([getSuppliers(), getPurchaseFormData()]);
  const totalPurchases = suppliers.reduce((sum, supplier) => sum + supplier.invoiceCount, 0);
  const pageCount = Math.max(1, Math.ceil(totalPurchases / 100));
  const page = Math.min(pageCount, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));
  const purchases = await getPurchases(page);

  const totalOutstanding = suppliers.reduce((sum, supplier) => sum + supplier.outstanding, 0);

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Purchasing"
        title="Suppliers"
        description="Suppliers and the purchase invoices for stock you buy from them."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <AddSupplierDialog />
            <PurchaseDialog
              suppliers={formData.suppliers}
              products={formData.products}
              methods={formData.methods}
            />
          </div>
        }
      />

      {/* Suppliers */}
      <section className="mt-8" aria-label="Suppliers">
        <div className="mb-3 flex items-center gap-3">
          <Truck className="text-muted-foreground size-4" aria-hidden="true" />
          <h2 className="label-caps text-muted-foreground">Suppliers</h2>
          <div className="bg-border h-px flex-1" />
          <span className="data-mono text-muted-foreground text-[13px]">{suppliers.length}</span>
        </div>

        {suppliers.length === 0 ? (
          <p className="border-border bg-card text-muted-foreground rounded-lg border px-4 py-10 text-center text-[13px]">
            No suppliers yet. Add one to start recording purchases.
          </p>
        ) : (
          <div className="border-border bg-card overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-border bg-primary-tint border-b">
                  <th className="label-caps text-muted-foreground px-4 py-3">Name</th>
                  <th className="label-caps text-muted-foreground px-4 py-3">Phone</th>
                  <th className="label-caps text-muted-foreground px-4 py-3">Email</th>
                  <th className="label-caps text-muted-foreground px-4 py-3 text-right">
                    Invoices
                  </th>
                  <th className="label-caps text-muted-foreground px-4 py-3 text-right">
                    Outstanding
                  </th>
                  <th className="label-caps text-muted-foreground px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} className="border-border border-b last:border-0">
                    <td className="px-4 py-3 text-sm font-medium">{s.name}</td>
                    <td className="text-muted-foreground px-4 py-3 text-sm">{s.phone ?? "—"}</td>
                    <td className="text-muted-foreground px-4 py-3 text-sm">{s.email ?? "—"}</td>
                    <td className="data-mono text-muted-foreground px-4 py-3 text-right">
                      {s.invoiceCount}
                    </td>
                    <td
                      className={`data-mono px-4 py-3 text-right ${
                        s.outstanding > 0 ? "text-warning font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {formatMoney(s.outstanding)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <EditSupplierDialog supplier={s} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Purchase invoices */}
      <section className="mt-8" aria-label="Purchase invoices">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="label-caps text-muted-foreground">Purchase invoices</h2>
          <div className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-[13px]">
            Outstanding:{" "}
            <span className="data-mono text-foreground">{formatMoney(totalOutstanding)}</span>
          </span>
        </div>

        {purchases.length === 0 ? (
          <p className="border-border bg-card text-muted-foreground rounded-lg border px-4 py-10 text-center text-[13px]">
            No purchase invoices yet.
          </p>
        ) : (
          <div className="border-border bg-card overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-border bg-primary-tint border-b">
                  <th className="label-caps text-muted-foreground px-4 py-3">Date</th>
                  <th className="label-caps text-muted-foreground px-4 py-3">Supplier</th>
                  <th className="label-caps text-muted-foreground px-4 py-3">Ref</th>
                  <th className="label-caps text-muted-foreground px-4 py-3 text-right">Items</th>
                  <th className="label-caps text-muted-foreground px-4 py-3 text-right">Total</th>
                  <th className="label-caps text-muted-foreground px-4 py-3 text-right">Paid</th>
                  <th className="label-caps text-muted-foreground px-4 py-3">Status</th>
                  <th className="label-caps text-muted-foreground px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-border border-b last:border-0">
                    <td className="data-mono text-muted-foreground px-4 py-3">
                      {formatDate(p.invoiceDate)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{p.supplierName}</td>
                    <td className="text-muted-foreground px-4 py-3 text-sm">
                      <Link
                        href={`/app/suppliers/purchases/${p.id}`}
                        className="text-primary hover:underline"
                      >
                        {p.reference || "View receipt"}
                      </Link>
                    </td>
                    <td className="data-mono text-muted-foreground px-4 py-3 text-right">
                      {p.lineCount}
                    </td>
                    <td className="data-mono px-4 py-3 text-right">{formatMoney(p.total)}</td>
                    <td className="data-mono text-muted-foreground px-4 py-3 text-right">
                      {formatMoney(p.paid)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded px-2 py-1 text-[11px] font-bold tracking-wide uppercase ${STATUS_STYLES[p.status]}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {p.outstanding > 0 && formData.methods.length > 0 && (
                          <PayInvoiceDialog
                            invoiceId={p.id}
                            supplierName={p.supplierName}
                            outstanding={p.outstanding}
                            methods={formData.methods}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {pageCount > 1 && (
        <nav aria-label="Purchase pages" className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={`/app/suppliers?page=${page - 1}`} className="text-primary underline">
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span>
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={`/app/suppliers?page=${page + 1}`} className="text-primary underline">
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </main>
  );
}
