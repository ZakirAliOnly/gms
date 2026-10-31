import { Boxes, TriangleAlert } from "lucide-react";
import Link from "@/components/workspace-link";
import { tenantDb } from "@/lib/tenant-db";
import { formatMoneyPrecise } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { serialLabel } from "@/lib/serial";
import {
  AddProductDialog,
  AdjustStockDialog,
  EditProductDialog,
  ToggleProductButton,
  type ProductRow,
} from "./product-dialogs";

export const metadata = { title: "Inventory" };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ low?: string }>;
}) {
  const lowOnly = (await searchParams).low === "1";
  const { db, tenantId } = await tenantDb();

  const records = await db.product.findMany({
    where: {
      tenantId,
      ...(lowOnly ? { isActive: true, quantity: { lte: db.product.fields.reorderLevel } } : {}),
    },
    orderBy: [{ isActive: "desc" }, { serial: "asc" }],
    select: {
      id: true,
      serial: true,
      name: true,
      category: true,
      photoUrl: true,
      costPrice: true,
      salePrice: true,
      quantity: true,
      reorderLevel: true,
      isActive: true,
    },
  });

  const products: ProductRow[] = records.map((p) => ({
    ...p,
    costPrice: p.costPrice.toString(),
    salePrice: p.salePrice.toString(),
  }));

  const lowStock = products.filter((p) => p.isActive && p.quantity <= p.reorderLevel);

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Retail"
        title="Inventory"
        description={
          lowOnly
            ? "Active products at or below their reorder level."
            : "Products, stock levels, and adjustments."
        }
        action={<AddProductDialog />}
      />

      {lowStock.length > 0 && (
        <div className="border-warning/30 bg-warning/5 text-warning mt-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-[13px]">
          <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
          <span>
            {lowStock.length} item{lowStock.length === 1 ? "" : "s"} at or below the reorder level:{" "}
            {lowStock.map((p) => p.name).join(", ")}.
          </span>
        </div>
      )}

      {products.length === 0 ? (
        <div className="border-border bg-card mt-6 flex flex-col items-center justify-center rounded-lg border px-6 py-16 text-center">
          <Boxes className="text-muted-foreground/50 size-8" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">No products yet</p>
          <p className="text-muted-foreground mt-1 text-[13px] leading-[18px]">
            Add one to start selling at the front desk.
          </p>
        </div>
      ) : (
        <div className="border-border bg-card mt-6 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-border bg-primary-tint border-b">
                <th className="label-caps text-muted-foreground px-4 py-3 text-right">#</th>
                <th className="label-caps text-muted-foreground px-4 py-3">Product</th>
                <th className="label-caps text-muted-foreground px-4 py-3">Category</th>
                <th className="label-caps text-muted-foreground px-4 py-3 text-right">Last cost</th>
                <th className="label-caps text-muted-foreground px-4 py-3 text-right">Price</th>
                <th className="label-caps text-muted-foreground px-4 py-3 text-right">In stock</th>
                <th className="label-caps text-muted-foreground px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const low = product.isActive && product.quantity <= product.reorderLevel;
                return (
                  <tr
                    key={product.id}
                    className={`border-border border-b last:border-0 ${
                      product.isActive ? "" : "opacity-55"
                    }`}
                  >
                    <td className="data-mono text-muted-foreground px-4 py-3 text-right">
                      {serialLabel(product.serial)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {product.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.photoUrl}
                            alt={product.name}
                            className="size-9 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="bg-secondary text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded text-[11px] font-bold"
                          >
                            {serialLabel(product.serial)}
                          </span>
                        )}
                        <p className="text-sm font-medium">
                          <Link
                            href={`/app/inventory/${product.id}`}
                            className="hover:text-primary hover:underline"
                          >
                            {product.name}
                          </Link>
                          {!product.isActive && (
                            <span className="bg-secondary text-muted-foreground ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                              Hidden
                            </span>
                          )}
                        </p>
                      </div>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-sm">
                      {product.category ?? "—"}
                    </td>
                    <td className="data-mono text-muted-foreground px-4 py-3 text-right">
                      {formatMoneyPrecise(product.costPrice)}
                    </td>
                    <td className="data-mono px-4 py-3 text-right">
                      {formatMoneyPrecise(product.salePrice)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`data-mono inline-block rounded px-2 py-1 ${
                          product.quantity === 0
                            ? "bg-destructive/10 text-destructive"
                            : low
                              ? "bg-warning/10 text-warning"
                              : ""
                        }`}
                      >
                        {product.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <AdjustStockDialog product={product} />
                        <EditProductDialog product={product} />
                        <ToggleProductButton product={product} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
