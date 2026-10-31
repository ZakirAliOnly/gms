"use client";

import { EditAccess } from "@/components/module-access-provider";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EditableInvoice } from "@/lib/invoice-management";
import { formatMoneyPrecise } from "@/lib/format";
import { updateInvoice } from "./history-actions";

export type InvoiceOptions = {
  products: { id: string; name: string; salePrice: string }[];
  members: { id: string; name: string }[];
  paymentMethods: { id: string; name: string }[];
};
const field =
  "w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
const secondary =
  "rounded border border-border px-3 py-2 text-sm hover:border-primary focus-visible:outline-2 focus-visible:outline-primary";

function InvoiceEditDialogContent({
  invoice,
  products,
  members,
  paymentMethods,
  onClose,
}: InvoiceOptions & { invoice: EditableInvoice; onClose: () => void }) {
  const [lines, setLines] = useState(invoice.lines);
  const [discount, setDiscount] = useState(invoice.discount);
  const [memberId, setMemberId] = useState(invoice.memberId ?? "");
  const [methodId, setMethodId] = useState(invoice.paymentMethodId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const subtotal =
    lines.reduce((sum, line) => sum + Math.round(Number(line.unitPrice) * 100) * line.quantity, 0) /
    100;
  const total = subtotal - (Number(discount) || 0);

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await updateInvoice({
          id: invoice.id,
          version: invoice.version,
          lines: lines.map(({ productId, quantity }) => ({ productId, quantity })),
          discount,
          memberId,
          paymentMethodId: methodId,
        });
        if ("error" in result) setError(result.error);
        else onClose();
      } catch {
        setError("Could not save the invoice. Please try again.");
      }
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className="border-border max-h-[90vh] overflow-y-auto rounded border sm:max-w-[640px]"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>Edit {invoice.number}</DialogTitle>
          <DialogDescription>
            Existing items keep their original prices. New items use current prices. Stock and
            payment balances update when you save.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-4">
          {error && (
            <p
              role="alert"
              className="border-destructive/30 bg-destructive/5 text-destructive rounded border px-3 py-2 text-sm"
            >
              {error}
            </p>
          )}
          <fieldset disabled={pending} className="flex min-w-0 flex-col gap-4 disabled:opacity-60">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                Customer
                <select
                  value={memberId}
                  onChange={(event) => setMemberId(event.target.value)}
                  className={field}
                >
                  <option value="">Walk-in customer</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Payment method
                <select
                  required
                  value={methodId}
                  onChange={(event) => setMethodId(event.target.value)}
                  className={field}
                >
                  {!paymentMethods.some((method) => method.id === invoice.paymentMethodId) && (
                    <option value={invoice.paymentMethodId}>
                      {invoice.receipt.paymentMethod} (archived)
                    </option>
                  )}
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <ul className="divide-border border-border divide-y rounded border">
              {lines.map((line) => (
                <li key={line.productId} className="flex flex-wrap items-center gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium break-words">{line.name}</p>
                    <p className="data-mono text-muted-foreground text-xs">
                      {formatMoneyPrecise(line.unitPrice)} each
                    </p>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="2147483647"
                    step="1"
                    required
                    aria-label={`Quantity for ${line.name}`}
                    value={line.quantity || ""}
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((item) =>
                          item.productId === line.productId
                            ? { ...item, quantity: Number(event.target.value) }
                            : item
                        )
                      )
                    }
                    className={`${field} w-20`}
                  />
                  <span className="data-mono text-sm">
                    {formatMoneyPrecise(Number(line.unitPrice) * line.quantity)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${line.name}`}
                    onClick={() =>
                      setLines((current) =>
                        current.filter((item) => item.productId !== line.productId)
                      )
                    }
                    className="text-destructive hover:bg-destructive/10 focus-visible:outline-primary rounded p-2 focus-visible:outline-2"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
              {lines.length === 0 && (
                <li className="text-muted-foreground p-3 text-sm">
                  Add at least one item to keep this invoice.
                </li>
              )}
            </ul>
            <label className="flex flex-col gap-1 text-sm">
              Add item
              <select
                value=""
                onChange={(event) => {
                  const product = products.find((item) => item.id === event.target.value);
                  if (!product) return;
                  const original = invoice.lines.find((item) => item.productId === product.id);
                  setLines((current) => [
                    ...current,
                    {
                      productId: product.id,
                      name: product.name,
                      quantity: 1,
                      unitPrice: original?.unitPrice ?? product.salePrice,
                    },
                  ]);
                }}
                className={field}
              >
                <option value="">Select a product</option>
                {products
                  .filter((product) => !lines.some((line) => line.productId === product.id))
                  .map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Discount (PKR)
              <input
                type="number"
                value={discount}
                min="0"
                max={subtotal}
                step="0.01"
                onChange={(event) => setDiscount(event.target.value)}
                className={field}
              />
            </label>
            <dl className="border-border space-y-2 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="data-mono">{formatMoneyPrecise(subtotal)}</dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>Total</dt>
                <dd className="data-mono">{formatMoneyPrecise(total)}</dd>
              </div>
            </dl>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className={secondary}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={lines.length === 0}
                className="bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:outline-primary rounded px-4 py-2 text-sm font-medium focus-visible:outline-2 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InvoiceEditDialog(props: React.ComponentProps<typeof InvoiceEditDialogContent>) {
  return (
    <EditAccess module="invoices">
      <InvoiceEditDialogContent {...props} />
    </EditAccess>
  );
}
