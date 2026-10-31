"use client";

import { EditAccess } from "@/components/module-access-provider";

import { useMemo, useState, useTransition } from "react";
import {
  Check,
  Minus,
  Package,
  Plus,
  ScanLine,
  Search,
  TriangleAlert,
  UserPlus,
  X,
} from "lucide-react";
import { formatMoney, formatMoneyPrecise } from "@/lib/format";
import { serialLabel, serialMatches } from "@/lib/serial";
import { createSale } from "./actions";
import { InvoiceDialog } from "./invoice-dialog";
import type { InvoiceReceipt } from "./invoice-receipt";

export type CatalogProduct = {
  id: string;
  serial: number;
  name: string;
  category: string | null;
  photoUrl: string | null;
  salePrice: string;
  quantity: number;
};

export type MemberOption = { id: string; name: string; barcode: string };
type PaymentMethod = { id: string; name: string };

type CartLine = { productId: string; quantity: number };

function PosTerminalContent({
  products,
  members,
  paymentMethods,
}: {
  products: CatalogProduct[];
  members: MemberOption[];
  paymentMethods: PaymentMethod[];
}) {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberQuery, setMemberQuery] = useState("");
  const [discount, setDiscount] = useState("");
  const [methodId, setMethodId] = useState(paymentMethods[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceReceipt | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || serialMatches(p.serial, q));
  }, [products, query]);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const lines = cart.map((line) => {
    const product = byId.get(line.productId)!;
    const unit = Number(product.salePrice);
    return { ...line, product, unit, lineTotal: unit * line.quantity };
  });

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const discountValue = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, subtotal - discountValue);

  const member = memberId ? (members.find((m) => m.id === memberId) ?? null) : null;

  const memberMatches = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return [];
    return members
      .filter((m) => m.name.toLowerCase().includes(q) || m.barcode.toLowerCase().includes(q))
      .slice(0, 5);
  }, [members, memberQuery]);

  function addToCart(product: CatalogProduct) {
    setError(null);
    setDone(null);
    setCart((current) => {
      const existing = current.find((l) => l.productId === product.id);
      const inCart = existing?.quantity ?? 0;
      if (inCart >= product.quantity) return current;
      return existing
        ? current.map((l) => (l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l))
        : [...current, { productId: product.id, quantity: 1 }];
    });
  }

  function setQuantity(productId: string, quantity: number) {
    const product = byId.get(productId);
    if (!product) return;
    const capped = Math.min(Math.max(0, quantity), product.quantity);
    setCart((current) =>
      capped === 0
        ? current.filter((l) => l.productId !== productId)
        : current.map((l) => (l.productId === productId ? { ...l, quantity: capped } : l))
    );
  }

  /** Enter on an exact serial (or a lone match) adds it straight to the cart. */
  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    const exact = products.find((p) => serialMatches(p.serial, q));
    const target = exact ?? (visible.length === 1 ? visible[0] : null);
    if (target && target.quantity > 0) {
      addToCart(target);
      setQuery("");
    }
  }

  function finalize() {
    if (pending) return;
    setError(null);
    setDone(null);

    if (cart.length === 0) return setError("Add at least one item.");
    if (!methodId) return setError("Select a payment method.");
    if (discountValue > subtotal) return setError("Discount cannot exceed the subtotal.");

    startTransition(async () => {
      const result = await createSale({
        lines: cart,
        discount: discountValue,
        paymentMethodId: methodId,
        memberId: memberId ?? undefined,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setCart([]);
      setDiscount("");
      setMemberId(null);
      setMemberQuery("");
      setDone(result.invoiceNumber ?? null);
      if (result.invoice) {
        setInvoice(result.invoice);
        setInvoiceOpen(true);
      }
    });
  }

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_380px]">
      {/* Catalogue */}
      <section className="border-border bg-card rounded-lg border" aria-label="Product catalog">
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <h2 className="text-lg font-semibold tracking-tight">Product catalog</h2>
          <div className="relative w-full sm:w-72">
            <ScanLine
              className="text-muted-foreground/60 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Serial number or name…"
              aria-label="Search products by serial number or name"
              className="border-input bg-background placeholder:text-muted-foreground/60 focus:border-primary focus:ring-primary w-full rounded border py-2 pr-3 pl-9 text-sm transition-colors outline-none focus:ring-1"
            />
          </div>
        </div>

        <div className="p-4">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="text-muted-foreground/50 size-8" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium">
                {products.length === 0 ? "No products yet" : "Nothing matches"}
              </p>
              <p className="text-muted-foreground mt-1 text-[13px]">
                {products.length === 0
                  ? "Add products in Inventory before making a sale."
                  : "Try a different search."}
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {visible.map((product) => {
                const inCart = cart.find((l) => l.productId === product.id)?.quantity ?? 0;
                const out = product.quantity === 0;
                const maxed = inCart >= product.quantity;
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => addToCart(product)}
                      disabled={out || maxed}
                      className={`flex h-full w-full flex-col rounded-lg border p-3 text-left transition-colors ${
                        inCart > 0 ? "border-primary bg-primary/5" : "border-border"
                      } ${out || maxed ? "cursor-not-allowed opacity-50" : "hover:border-primary"}`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                            out
                              ? "bg-destructive/10 text-destructive"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {out ? "Out of stock" : `${product.quantity} in stock`}
                        </span>
                        {inCart > 0 && (
                          <span className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                            {inCart}
                          </span>
                        )}
                      </div>
                      {product.photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.photoUrl}
                          alt=""
                          className="mb-2 h-20 w-full rounded object-cover"
                        />
                      )}
                      <p className="text-sm leading-snug font-medium">{product.name}</p>
                      <p className="data-mono text-muted-foreground mt-0.5 text-[11px]">
                        #{serialLabel(product.serial)}
                      </p>
                      <p className="data-mono text-primary mt-auto pt-2 text-sm font-semibold">
                        {formatMoneyPrecise(product.salePrice)}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Cart */}
      <section
        className="border-border bg-card flex h-fit flex-col rounded-lg border lg:sticky lg:top-24"
        aria-label="Current invoice"
      >
        <div className="border-border border-b p-4">
          <h2 className="text-lg font-semibold tracking-tight">Current invoice</h2>
        </div>

        {/* Member lookup */}
        <div className="border-border border-b p-4">
          <p className="label-caps text-muted-foreground mb-2">Member (optional)</p>
          {member ? (
            <div className="border-border bg-secondary/50 flex items-center gap-2 rounded border px-3 py-2">
              <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded text-[11px] font-bold">
                {member.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase())
                  .join("")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{member.name}</p>
                <p className="data-mono text-muted-foreground truncate text-[11px]">
                  {member.barcode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMemberId(null)}
                aria-label="Remove member"
                className="text-muted-foreground hover:text-destructive rounded p-1 transition-colors"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search
                className="text-muted-foreground/60 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder="Scan ID or enter name…"
                aria-label="Look up a member"
                className="border-input bg-background placeholder:text-muted-foreground/60 focus:border-primary focus:ring-primary w-full rounded border py-2 pr-3 pl-9 text-sm transition-colors outline-none focus:ring-1"
              />
              {memberMatches.length > 0 && (
                <ul className="border-border bg-card absolute z-10 mt-1 w-full overflow-hidden rounded border">
                  {memberMatches.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setMemberId(m.id);
                          setMemberQuery("");
                        }}
                        className="hover:bg-secondary flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors"
                      >
                        <UserPlus
                          className="text-muted-foreground size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate">{m.name}</span>
                        <span className="data-mono text-muted-foreground ml-auto shrink-0 text-[11px]">
                          {m.barcode}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Lines */}
        <div className="max-h-[40vh] overflow-y-auto">
          {lines.length === 0 ? (
            <p className="text-muted-foreground px-4 py-10 text-center text-[13px]">
              No items yet. Tap a product to add it.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {lines.map((line) => (
                <li key={line.productId} className="flex items-start gap-2.5 px-4 py-3">
                  {line.product.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={line.product.photoUrl}
                      alt=""
                      className="size-10 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="bg-secondary text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded text-[10px] font-bold"
                    >
                      #{serialLabel(line.product.serial)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{line.product.name}</p>
                    <p className="data-mono text-muted-foreground text-[12px]">
                      {formatMoneyPrecise(line.unit)}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setQuantity(line.productId, line.quantity - 1)}
                        aria-label={`Decrease ${line.product.name}`}
                        className="border-border text-muted-foreground hover:border-primary hover:text-primary flex size-6 items-center justify-center rounded border transition-colors"
                      >
                        <Minus className="size-3" aria-hidden="true" />
                      </button>
                      <span className="data-mono w-8 text-center text-sm">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(line.productId, line.quantity + 1)}
                        disabled={line.quantity >= line.product.quantity}
                        aria-label={`Increase ${line.product.name}`}
                        className="border-border text-muted-foreground hover:border-primary hover:text-primary flex size-6 items-center justify-center rounded border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus className="size-3" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <p className="data-mono shrink-0 text-sm font-medium">
                    {formatMoneyPrecise(line.lineTotal)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Totals */}
        <div className="border-border border-t p-4">
          <dl className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground text-[13px]">Subtotal</dt>
              <dd className="data-mono text-sm">{formatMoneyPrecise(subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground text-[13px]">
                <label htmlFor="discount">Discount</label>
              </dt>
              <dd>
                <input
                  id="discount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0"
                  className="border-input bg-background focus:border-primary focus:ring-primary w-28 rounded border px-2 py-1 text-right text-sm transition-colors outline-none focus:ring-1"
                />
              </dd>
            </div>
          </dl>

          <div className="border-border mt-3 flex items-center justify-between gap-3 border-t pt-3">
            <p className="text-lg font-semibold">Total</p>
            <p className="data-mono text-primary text-lg font-bold">{formatMoney(total)}</p>
          </div>
        </div>

        {/* Payment */}
        <div className="border-border border-t p-4">
          <p className="label-caps text-muted-foreground mb-2">Payment method</p>
          {paymentMethods.length === 0 ? (
            <p className="border-border bg-secondary text-muted-foreground rounded border px-3 py-2 text-[13px]">
              Add a payment method before taking a sale.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethodId(m.id)}
                  aria-pressed={methodId === m.id}
                  className={`truncate rounded border px-2 py-2.5 text-[13px] font-medium transition-colors ${
                    methodId === m.id
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="border-destructive/30 bg-destructive/5 text-destructive mt-3 flex items-start gap-2 rounded border px-3 py-2 text-[13px]"
            >
              <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {done && (
            <div
              role="status"
              className="border-success/30 bg-success/5 text-success mt-3 flex items-start gap-2 rounded border px-3 py-2 text-[13px]"
            >
              <Check className="mt-px size-4 shrink-0" aria-hidden="true" />
              <span>Sale recorded as {done}.</span>
            </div>
          )}

          <button
            type="button"
            onClick={finalize}
            disabled={pending || cart.length === 0 || paymentMethods.length === 0}
            className="bg-primary text-primary-foreground hover:bg-primary-hover mt-3 w-full rounded py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Recording…" : "Checkout"}
          </button>
        </div>
      </section>
      {invoice && (
        <InvoiceDialog
          key={invoice.number}
          invoice={invoice}
          open={invoiceOpen}
          onOpenChange={setInvoiceOpen}
        />
      )}
    </div>
  );
}

export function PosTerminal(props: React.ComponentProps<typeof PosTerminalContent>) {
  return (
    <EditAccess module="invoices">
      <PosTerminalContent {...props} />
    </EditAccess>
  );
}
