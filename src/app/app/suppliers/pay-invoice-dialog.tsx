"use client";

import { useState } from "react";
import { useFeedbackAction } from "@/components/use-feedback-action";
import { useFormStatus } from "react-dom";
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
import { addPurchasePayment, type SupplierState } from "./actions";
import type { MethodOption } from "./data";

const inputClass =
  "w-full rounded border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary aria-invalid:border-destructive";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary text-primary-foreground hover:bg-primary-hover rounded px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Recording…" : "Record payment"}
    </button>
  );
}

export function PayInvoiceDialog({
  invoiceId,
  supplierName,
  outstanding,
  methods,
}: {
  invoiceId: string;
  supplierName: string;
  outstanding: number;
  methods: MethodOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFeedbackAction<SupplierState, FormData>(addPurchasePayment, {}, () =>
    setOpen(false)
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="border-border text-muted-foreground hover:border-primary hover:text-primary rounded border px-3 py-1.5 text-[13px] font-medium transition-colors">
          Pay
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {supplierName} — {formatMoney(outstanding)} outstanding
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="purchaseInvoiceId" value={invoiceId} />

          <div className="flex flex-col">
            <label htmlFor="amount" className="label-caps text-muted-foreground mb-1">
              Amount (PKR)
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={outstanding}
              required
              autoFocus
              defaultValue={outstanding}
              aria-invalid={state.fieldErrors?.amount ? true : undefined}
              className={inputClass}
            />
            {state.fieldErrors?.amount && (
              <p className="text-destructive mt-1 text-[13px]">{state.fieldErrors.amount}</p>
            )}
          </div>

          <div className="flex flex-col">
            <label htmlFor="paymentMethodId" className="label-caps text-muted-foreground mb-1">
              Paid from
            </label>
            <select
              id="paymentMethodId"
              name="paymentMethodId"
              required
              defaultValue={methods[0]?.id}
              aria-invalid={state.fieldErrors?.paymentMethodId ? true : undefined}
              className={inputClass}
            >
              {methods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {state.fieldErrors?.paymentMethodId && (
              <p className="text-destructive mt-1 text-[13px]">
                {state.fieldErrors.paymentMethodId}
              </p>
            )}
          </div>

          {state.error && <p className="text-destructive text-[13px]">{state.error}</p>}

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="border-border text-muted-foreground hover:border-primary hover:text-primary rounded border px-4 py-2.5 text-sm transition-colors"
            >
              Cancel
            </button>
            <Submit />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
