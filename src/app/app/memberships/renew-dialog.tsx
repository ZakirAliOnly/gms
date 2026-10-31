"use client";

import { EditAccess } from "@/components/module-access-provider";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addMonths, format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { renewMembership, type ActionState } from "./actions";
import { InvoiceDialog } from "../invoices/invoice-dialog";

const inputClass =
  "w-full rounded border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary aria-invalid:border-destructive";

type PaymentMethod = { id: string; name: string };
type Extra = { id: string; name: string; fee: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary text-primary-foreground hover:bg-primary-hover rounded px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Recording…" : "Record renewal"}
    </button>
  );
}

function RenewDialogContent({
  membershipId,
  memberName,
  packageFee,
  extras,
  paymentMethods,
  open,
  onOpenChange,
}: {
  membershipId: string;
  memberName: string;
  packageFee: string;
  extras: Extra[];
  paymentMethods: PaymentMethod[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(renewMembership, {});

  if (state.ok && state.receipt) {
    return (
      <InvoiceDialog
        key={state.receipt.number}
        invoice={state.receipt}
        open={open}
        onOpenChange={onOpenChange}
      />
    );
  }

  // The schedule moves to one month from today, not from the old due date.
  const nextDue = addMonths(new Date(), 1);

  // Prefill the amount with package fee + every extra. The operator can still
  // adjust it before recording.
  const extrasTotal = extras.reduce((sum, x) => sum + Number(x.fee), 0);
  const defaultAmount = String(Number(packageFee) + extrasTotal);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Renew membership</DialogTitle>
          <DialogDescription>{memberName}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="membershipId" value={membershipId} />

          {state.error && (
            <div
              role="alert"
              className="border-destructive/30 bg-destructive/5 text-destructive rounded border px-3 py-2.5 text-[13px]"
            >
              {state.error}
            </div>
          )}

          {extras.length > 0 && (
            <dl className="border-border bg-secondary/50 rounded border px-3 py-2.5 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Package fee</dt>
                <dd className="data-mono">{formatMoney(packageFee)}</dd>
              </div>
              {extras.map((x) => (
                <div key={x.id} className="flex justify-between">
                  <dt className="text-muted-foreground">{x.name}</dt>
                  <dd className="data-mono">{formatMoney(x.fee)}</dd>
                </div>
              ))}
              <div className="border-border mt-1 flex justify-between border-t pt-1 font-medium">
                <dt>Total</dt>
                <dd className="data-mono">{formatMoney(defaultAmount)}</dd>
              </div>
            </dl>
          )}

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
              required
              autoFocus
              defaultValue={defaultAmount}
              aria-invalid={state.fieldErrors?.amount ? true : undefined}
              className={inputClass}
            />
            {state.fieldErrors?.amount && (
              <p className="text-destructive mt-1 text-[13px]">{state.fieldErrors.amount}</p>
            )}
          </div>

          <div className="flex flex-col">
            <label htmlFor="paymentMethodId" className="label-caps text-muted-foreground mb-1">
              Payment method
            </label>
            <select
              id="paymentMethodId"
              name="paymentMethodId"
              required
              defaultValue={paymentMethods[0]?.id}
              aria-invalid={state.fieldErrors?.paymentMethodId ? true : undefined}
              className={inputClass}
            >
              {paymentMethods.map((m) => (
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

          <p className="border-border bg-secondary text-muted-foreground rounded border px-3 py-2.5 text-[13px] leading-[18px]">
            Next renewal moves to <strong>{format(nextDue, "dd MMM yyyy")}</strong> — one month from
            today, not from the previous due date.
          </p>

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="border-border text-muted-foreground hover:border-primary hover:text-primary rounded border px-4 py-2.5 text-sm transition-colors"
            >
              Cancel
            </button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RenewDialog(props: React.ComponentProps<typeof RenewDialogContent>) {
  return (
    <EditAccess module="memberships">
      <RenewDialogContent {...props} />
    </EditAccess>
  );
}
