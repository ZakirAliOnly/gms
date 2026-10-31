"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Plus, Search, Trash2, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { serialLabel, serialMatches } from "@/lib/serial";
import { createPurchase } from "./actions";
import type { MethodOption, ProductOption, SupplierOption } from "./data";

const inputClass =
  "w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary";

type Line = {
  productId: string;
  quantity: number;
  /** Per-unit cost from the supplier. */
  unitCost: number;
  /** New per-unit sale price to set on the product. */
  unitSalePrice: number;
};

export function PurchaseDialog({
  suppliers,
  products,
  methods,
}: {
  suppliers: SupplierOption[];
  products: ProductOption[];
  methods: MethodOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Supplier: a search box that filters a dropdown.
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierId, setSupplierId] = useState("");

  const [reference, setReference] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));

  const [lines, setLines] = useState<Line[]>([]);

  // Product: same search-box-to-dropdown pattern as the supplier picker.
  const [productQuery, setProductQuery] = useState("");
  const [productOpen, setProductOpen] = useState(false);

  const [amountPaid, setAmountPaid] = useState("");
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");

  // Both pickers show the 10 most recent (data.ts orders newest-first) until a
  // search narrows them.
  const supplierMatches = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    const list = q ? suppliers.filter((s) => s.name.toLowerCase().includes(q)) : suppliers;
    return list.slice(0, 10);
  }, [suppliers, supplierQuery]);

  const productMatches = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    const list = q
      ? products.filter((p) => p.name.toLowerCase().includes(q) || serialMatches(p.serial, q))
      : products;
    // Do not offer products already on the invoice.
    const onInvoice = new Set(lines.map((l) => l.productId));
    return list.filter((p) => !onInvoice.has(p.id)).slice(0, 10);
  }, [products, productQuery, lines]);

  const chosenSupplier = suppliers.find((s) => s.id === supplierId) ?? null;
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const total = lines.reduce((sum, l) => sum + l.quantity * (Number(l.unitCost) || 0), 0);
  const paid = Math.max(0, Number(amountPaid) || 0);

  const needsMethod = paid > 0;
  const noMethods = methods.length === 0;

  function reset() {
    setSupplierQuery("");
    setSupplierId("");
    setReference("");
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setLines([]);
    setProductQuery("");
    setProductOpen(false);
    setAmountPaid("");
    setError(null);
    setDone(false);
  }

  function addProduct(productId: string) {
    setLines((cur) =>
      cur.some((l) => l.productId === productId)
        ? cur
        : [...cur, { productId, quantity: 1, unitCost: 0, unitSalePrice: 0 }]
    );
    setProductQuery("");
    setProductOpen(false);
  }

  function updateLine(productId: string, patch: Partial<Line>) {
    setLines((cur) => cur.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));
  }

  function removeLine(productId: string) {
    setLines((cur) => cur.filter((l) => l.productId !== productId));
  }

  function submit() {
    setError(null);

    if (!supplierId) return setError("Select a supplier.");
    if (lines.length === 0) return setError("Add at least one product.");
    if (lines.some((l) => l.quantity < 1))
      return setError("Every line needs a quantity of 1 or more.");
    if (lines.some((l) => (Number(l.unitCost) || 0) <= 0))
      return setError("Enter a cost for every line.");
    if (lines.some((l) => (Number(l.unitSalePrice) || 0) <= 0))
      return setError("Enter a sale price for every line.");
    if (needsMethod && !methodId) return setError("Choose a payment method for the amount paid.");
    if (paid > total + 0.001) return setError("Amount paid cannot exceed the invoice total.");

    startTransition(async () => {
      const result = await createPurchase({
        supplierId,
        reference: reference || undefined,
        invoiceDate,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitCost: Number(l.unitCost) || 0,
          unitSalePrice: Number(l.unitSalePrice) || 0,
        })),
        amountPaid: paid,
        paymentMethodId: needsMethod ? methodId : undefined,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setDone(true);
      setTimeout(() => {
        setOpen(false);
        reset();
      }, 700);
    });
  }

  const noSuppliers = suppliers.length === 0;
  const noProducts = products.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <button className="bg-primary text-primary-foreground hover:bg-primary-hover flex items-center gap-2 rounded px-4 py-2.5 text-sm font-medium transition-colors">
          <Plus className="size-4" aria-hidden="true" />
          New purchase invoice
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>New purchase invoice</DialogTitle>
          <DialogDescription>
            Records stock received from a supplier. Posting it increases quantity on hand — it does
            not change any product&rsquo;s sale price.
          </DialogDescription>
        </DialogHeader>

        {noSuppliers || noProducts ? (
          <p className="border-border bg-secondary text-muted-foreground rounded border px-3 py-3 text-[13px]">
            {noSuppliers
              ? "Add a supplier first."
              : "Add at least one product in Inventory before recording a purchase."}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {error && (
              <div
                role="alert"
                className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded border px-3 py-2.5 text-[13px]"
              >
                <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {/* Supplier: search box -> dropdown of matches */}
            <div className="flex flex-col">
              <label htmlFor="supplier-search" className="label-caps text-muted-foreground mb-1">
                Supplier
              </label>
              {chosenSupplier ? (
                <div className="border-border bg-secondary/50 flex items-center justify-between gap-2 rounded border px-3 py-2 text-sm">
                  <span className="font-medium">{chosenSupplier.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSupplierId("");
                      setSupplierQuery("");
                    }}
                    className="text-muted-foreground hover:text-primary text-[13px]"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search
                    className="text-muted-foreground/60 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    id="supplier-search"
                    value={supplierQuery}
                    onChange={(e) => setSupplierQuery(e.target.value)}
                    placeholder="Search suppliers…"
                    className={`${inputClass} pl-9`}
                    autoComplete="off"
                  />
                  {supplierMatches.length > 0 && (
                    <ul className="border-border bg-card absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border">
                      {supplierMatches.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSupplierId(s.id);
                              setSupplierQuery("");
                            }}
                            className="hover:bg-secondary w-full px-3 py-2 text-left text-sm transition-colors"
                          >
                            {s.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label htmlFor="reference" className="label-caps text-muted-foreground mb-1">
                  Supplier&rsquo;s invoice #{" "}
                  <span className="font-normal tracking-normal normal-case">(optional)</span>
                </label>
                <input
                  id="reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col">
                <label htmlFor="invoice-date" className="label-caps text-muted-foreground mb-1">
                  Date
                </label>
                <input
                  id="invoice-date"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Product picker: search box -> dropdown, 10 recent by default */}
            <div className="flex flex-col">
              <label htmlFor="product-search" className="label-caps text-muted-foreground mb-1">
                Products bought
              </label>
              <div className="relative">
                <Search
                  className="text-muted-foreground/60 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  id="product-search"
                  value={productQuery}
                  onChange={(e) => {
                    setProductQuery(e.target.value);
                    setProductOpen(true);
                  }}
                  onFocus={() => setProductOpen(true)}
                  placeholder="Search products to add…"
                  className={`${inputClass} pl-9`}
                  autoComplete="off"
                />
                {productOpen && productMatches.length > 0 && (
                  <ul className="border-border bg-card absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded border">
                    {productMatches.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => addProduct(p.id)}
                          className="hover:bg-secondary flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors"
                        >
                          <span className="truncate">{p.name}</span>
                          <span className="data-mono text-muted-foreground shrink-0 text-[11px]">
                            #{serialLabel(p.serial)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {productOpen && productQuery.trim() && productMatches.length === 0 && (
                  <p className="border-border bg-card text-muted-foreground absolute z-10 mt-1 w-full rounded border px-3 py-2 text-[13px]">
                    No matching products.
                  </p>
                )}
              </div>
            </div>

            {lines.length > 0 && (
              <div className="border-border overflow-x-auto rounded border">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-border bg-primary-tint border-b">
                      <th className="label-caps text-muted-foreground px-3 py-2">Product</th>
                      <th className="label-caps text-muted-foreground px-3 py-2 text-right">Qty</th>
                      <th className="label-caps text-muted-foreground px-3 py-2 text-right">
                        Cost / unit
                      </th>
                      <th className="label-caps text-muted-foreground px-3 py-2 text-right">
                        Sale / unit
                      </th>
                      <th className="label-caps text-muted-foreground px-3 py-2 text-right">
                        Line total
                      </th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => {
                      const product = productById.get(line.productId);
                      const lineTotal = line.quantity * (Number(line.unitCost) || 0);
                      return (
                        <tr key={line.productId} className="border-border border-b last:border-0">
                          <td className="px-3 py-2">{product?.name ?? "—"}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="1"
                              value={line.quantity}
                              onChange={(e) =>
                                updateLine(line.productId, {
                                  quantity: Math.max(1, Number(e.target.value) || 1),
                                })
                              }
                              className="border-input bg-background focus:border-primary focus:ring-primary w-14 rounded border px-2 py-1 text-right text-sm outline-none focus:ring-1"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.unitCost || ""}
                              onChange={(e) =>
                                updateLine(line.productId, {
                                  unitCost: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              placeholder="0"
                              className="border-input bg-background focus:border-primary focus:ring-primary w-24 rounded border px-2 py-1 text-right text-sm outline-none focus:ring-1"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.unitSalePrice || ""}
                              onChange={(e) =>
                                updateLine(line.productId, {
                                  unitSalePrice: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              placeholder="0"
                              className="border-input bg-background focus:border-primary focus:ring-primary w-24 rounded border px-2 py-1 text-right text-sm outline-none focus:ring-1"
                            />
                          </td>
                          <td className="data-mono text-muted-foreground px-3 py-2 text-right">
                            {formatMoney(lineTotal)}
                          </td>
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeLine(line.productId)}
                              aria-label="Remove line"
                              className="text-muted-foreground hover:text-destructive rounded p-1 transition-colors"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-muted-foreground text-[12px]">
              The sale price you enter here becomes the product&rsquo;s new sale price when the
              invoice is saved.
            </p>

            <div className="border-border flex items-center justify-between border-t pt-3">
              <p className="label-caps text-muted-foreground">Invoice total</p>
              <p className="data-mono text-primary text-lg font-bold">{formatMoney(total)}</p>
            </div>

            {/* Payment now */}
            {noMethods ? (
              <p className="border-warning/30 bg-warning/5 text-warning rounded border px-3 py-2.5 text-[13px]">
                No payment methods exist yet. The invoice will be saved as unpaid — add a method in
                Payment Methods to record what you paid.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label htmlFor="amount-paid" className="label-caps text-muted-foreground mb-1">
                    Amount paid now
                  </label>
                  <input
                    id="amount-paid"
                    type="number"
                    min="0"
                    max={total || undefined}
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => {
                      const entered = Number(e.target.value);
                      // Cannot pay more than the invoice is for.
                      if (e.target.value === "" || Number.isNaN(entered)) {
                        setAmountPaid(e.target.value);
                      } else {
                        setAmountPaid(String(Math.min(Math.max(0, entered), total)));
                      }
                    }}
                    placeholder="0"
                    className={inputClass}
                  />
                  <p className="text-muted-foreground mt-1 text-[12px]">
                    {total > 0
                      ? `Up to ${formatMoney(total)}. Leave as 0 to record it as unpaid.`
                      : "Add products first to set the invoice total."}
                  </p>
                </div>

                <div className="flex flex-col">
                  <label
                    htmlFor="pm"
                    className={`label-caps mb-1 ${needsMethod ? "text-muted-foreground" : "text-muted-foreground/50"}`}
                  >
                    Paid from
                  </label>
                  <select
                    id="pm"
                    value={methodId}
                    onChange={(e) => setMethodId(e.target.value)}
                    disabled={!needsMethod}
                    className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {methods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  {!needsMethod && (
                    <p className="text-muted-foreground mt-1 text-[12px]">
                      Enter an amount above to select a method.
                    </p>
                  )}
                </div>
              </div>
            )}

            {done && (
              <div
                role="status"
                className="border-success/30 bg-success/5 text-success flex items-center gap-2 rounded border px-3 py-2 text-[13px]"
              >
                <Check className="size-4 shrink-0" aria-hidden="true" />
                Purchase invoice recorded.
              </div>
            )}

            <DialogFooter className="mt-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="border-border text-muted-foreground hover:border-primary hover:text-primary rounded border px-4 py-2.5 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="bg-primary text-primary-foreground hover:bg-primary-hover rounded px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save invoice"}
              </button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
