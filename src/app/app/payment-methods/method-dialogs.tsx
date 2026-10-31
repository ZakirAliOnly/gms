"use client";

import { EditAccess } from "@/components/module-access-provider";

import { FormField } from "@/components/form-field";

import { useFeedbackAction } from "@/components/use-feedback-action";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeftRight, Archive, Pencil, Plus, TriangleAlert, Undo2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { MethodBalance } from "./data";
import {
  createPaymentMethod,
  createTransfer,
  togglePaymentMethod,
  updatePaymentMethod,
  type MethodState,
} from "./actions";

const inputClass =
  "w-full rounded border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary aria-invalid:border-destructive";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary text-primary-foreground hover:bg-primary-hover rounded px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}) {
  return (
    <FormField id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={inputClass}
        {...props}
      />
    </FormField>
  );
}

function AddMethodDialogContent() {
  const [open, setOpen] = useState(false);
  const [state, action] = useFeedbackAction<MethodState, FormData>(createPaymentMethod, {}, () => {
    setOpen(false);
    formRef.current?.reset();
  });
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="bg-primary text-primary-foreground hover:bg-primary-hover flex items-center gap-2 rounded px-4 py-2.5 text-sm font-medium transition-colors">
          <Plus className="size-4" aria-hidden="true" />
          Add method
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Add method</DialogTitle>
          <DialogDescription>
            A cash drawer, wallet, or bank account money passes through.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={action} className="flex flex-col gap-4" noValidate>
          <Field
            id="name"
            label="Method name"
            required
            autoFocus
            placeholder="Meezan Bank"
            error={state.fieldErrors?.name}
          />
          <Field
            id="openingBalance"
            label="Opening balance (PKR)"
            type="number"
            step="0.01"
            defaultValue={0}
            hint="What the channel holds today. Later movements build on it."
            error={state.fieldErrors?.openingBalance}
          />

          <DialogFooter className="mt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="border-border text-muted-foreground hover:border-primary hover:text-primary rounded border px-4 py-2.5 text-sm transition-colors"
            >
              Cancel
            </button>
            <Submit label="Add method" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditMethodDialogContent({ method }: { method: MethodBalance }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFeedbackAction<MethodState, FormData>(updatePaymentMethod, {}, () => {
    setOpen(false);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          title="Edit"
          className="border-border text-primary hover:border-primary hover:bg-primary-tint rounded border p-1.5 transition-colors"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Edit {method.name}</span>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Edit method</DialogTitle>
          <DialogDescription>
            Changing the opening balance shifts the current balance by the same amount.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="id" value={method.id} />
          <Field
            id="name"
            label="Method name"
            required
            defaultValue={method.name}
            error={state.fieldErrors?.name}
          />
          <Field
            id="openingBalance"
            label="Opening balance (PKR)"
            type="number"
            step="0.01"
            defaultValue={method.openingBalance}
            error={state.fieldErrors?.openingBalance}
          />

          {state.error && <p className="text-destructive text-[13px]">{state.error}</p>}

          <DialogFooter className="mt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="border-border text-muted-foreground hover:border-primary hover:text-primary rounded border px-4 py-2.5 text-sm transition-colors"
            >
              Cancel
            </button>
            <Submit label="Save" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ToggleSubmit({ isActive, name }: { isActive: boolean; name: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      title={isActive ? "Archive this method" : "Restore this method"}
      className="border-border text-primary hover:border-primary hover:bg-primary-tint rounded border p-1.5 transition-colors disabled:opacity-50"
    >
      {isActive ? (
        <Archive className="size-3.5" aria-hidden="true" />
      ) : (
        <Undo2 className="size-3.5" aria-hidden="true" />
      )}
      <span className="sr-only">{isActive ? "Archive " + name : "Restore " + name}</span>
    </button>
  );
}

function ToggleMethodButtonContent({ method }: { method: MethodBalance }) {
  const [, action] = useActionState<MethodState, FormData>(togglePaymentMethod, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={method.id} />
      <ToggleSubmit isActive={method.isActive} name={method.name} />
    </form>
  );
}

function TransferDialogContent({
  methods,
  fromId,
  compact = false,
}: {
  methods: MethodBalance[];
  fromId?: string;
  /** Icon-only trigger, for the button on each method card. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFeedbackAction<MethodState, FormData>(createTransfer, {}, () => {
    setOpen(false);
    formRef.current?.reset();
  });
  const formRef = useRef<HTMLFormElement>(null);

  const active = methods.filter((m) => m.isActive);
  const enough = active.length >= 2;
  const defaultFrom = fromId ?? active[0]?.id;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {compact ? (
          <button
            title="Transfer from here"
            className="border-border text-primary hover:border-primary hover:bg-primary-tint rounded border p-1.5 transition-colors"
          >
            <ArrowLeftRight className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Transfer</span>
          </button>
        ) : (
          <button className="border-border bg-card text-muted-foreground hover:border-primary hover:text-primary flex items-center gap-2 rounded border px-4 py-2.5 text-sm font-medium transition-colors">
            <ArrowLeftRight className="size-4" aria-hidden="true" />
            Transfer
          </button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Transfer between methods</DialogTitle>
          <DialogDescription>
            Moves money you already hold. Not income or an expense, so revenue and expense reports
            are unaffected.
          </DialogDescription>
        </DialogHeader>

        {!enough ? (
          <p className="border-border bg-secondary text-muted-foreground rounded border px-3 py-3 text-[13px]">
            You need at least two active methods to transfer between.
          </p>
        ) : (
          <form ref={formRef} action={action} className="flex flex-col gap-4" noValidate>
            {state.error && (
              <div
                role="alert"
                className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded border px-3 py-2.5 text-[13px]"
              >
                <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
                <span>{state.error}</span>
              </div>
            )}

            <div className="flex flex-col">
              <label htmlFor="fromMethodId" className="label-caps text-muted-foreground mb-1">
                From
              </label>
              <select
                id="fromMethodId"
                name="fromMethodId"
                required
                defaultValue={defaultFrom}
                className={inputClass}
              >
                {active.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              {state.fieldErrors?.fromMethodId && (
                <p className="text-destructive mt-1 text-[13px]">
                  {state.fieldErrors.fromMethodId}
                </p>
              )}
            </div>

            <div className="flex flex-col">
              <label htmlFor="toMethodId" className="label-caps text-muted-foreground mb-1">
                To
              </label>
              <select
                id="toMethodId"
                name="toMethodId"
                required
                defaultValue={active.find((m) => m.id !== defaultFrom)?.id}
                className={inputClass}
              >
                {active.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              {state.fieldErrors?.toMethodId && (
                <p className="text-destructive mt-1 text-[13px]">{state.fieldErrors.toMethodId}</p>
              )}
            </div>

            <Field
              id="amount"
              label="Amount (PKR)"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="10000"
              error={state.fieldErrors?.amount}
            />
            <Field id="note" label="Note (optional)" placeholder="Cash deposited at branch" />

            <DialogFooter className="mt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="border-border text-muted-foreground hover:border-primary hover:text-primary rounded border px-4 py-2.5 text-sm transition-colors"
              >
                Cancel
              </button>
              <Submit label="Record transfer" />
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AddMethodDialog() {
  return (
    <EditAccess module="payment-methods">
      <AddMethodDialogContent />
    </EditAccess>
  );
}
export function EditMethodDialog(props: React.ComponentProps<typeof EditMethodDialogContent>) {
  return (
    <EditAccess module="payment-methods">
      <EditMethodDialogContent {...props} />
    </EditAccess>
  );
}
export function ToggleMethodButton(props: React.ComponentProps<typeof ToggleMethodButtonContent>) {
  return (
    <EditAccess module="payment-methods">
      <ToggleMethodButtonContent {...props} />
    </EditAccess>
  );
}
export function TransferDialog(props: React.ComponentProps<typeof TransferDialogContent>) {
  return (
    <EditAccess module="payment-methods">
      <TransferDialogContent {...props} />
    </EditAccess>
  );
}
