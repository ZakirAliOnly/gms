"use client";

import { FormField } from "@/components/form-field";

import { useFeedbackAction } from "@/components/use-feedback-action";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Tags, Trash2, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createCategory, createExpense, deleteExpense, type ExpenseState } from "./actions";

const inputClass =
  "w-full rounded border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary aria-invalid:border-destructive";

export type CategoryOption = { id: string; name: string };
export type MethodOption = { id: string; name: string };

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
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
}) {
  return (
    <FormField id={id} label={label} error={error}>
      <input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass}
        {...props}
      />
    </FormField>
  );
}

export function AddExpenseDialog({
  categories,
  methods,
  initiallyOpen = false,
}: {
  initiallyOpen?: boolean;
  categories: CategoryOption[];
  methods: MethodOption[];
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [state, action] = useFeedbackAction<ExpenseState, FormData>(createExpense, {}, () => {
    setOpen(false);
    formRef.current?.reset();
  });
  const formRef = useRef<HTMLFormElement>(null);

  const blocked = categories.length === 0 || methods.length === 0;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="bg-primary text-primary-foreground hover:bg-primary-hover flex items-center gap-2 rounded px-4 py-2.5 text-sm font-medium transition-colors">
          <Plus className="size-4" aria-hidden="true" />
          Record expense
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Record expense</DialogTitle>
          <DialogDescription>
            The amount is deducted from the payment method you choose.
          </DialogDescription>
        </DialogHeader>

        {blocked ? (
          <p className="border-border bg-secondary text-muted-foreground rounded border px-3 py-3 text-[13px]">
            {categories.length === 0
              ? "Add a category first, using the Categories button."
              : "Add a payment method before recording expenses."}
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
              <label htmlFor="categoryId" className="label-caps text-muted-foreground mb-1">
                Category
              </label>
              <select
                id="categoryId"
                name="categoryId"
                required
                defaultValue={categories[0]?.id}
                className={inputClass}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {state.fieldErrors?.categoryId && (
                <p className="text-destructive mt-1 text-[13px]">{state.fieldErrors.categoryId}</p>
              )}
            </div>

            <Field
              id="amount"
              label="Amount (PKR)"
              type="number"
              step="0.01"
              min="0.01"
              required
              autoFocus
              placeholder="12000"
              error={state.fieldErrors?.amount}
            />

            <div className="flex flex-col">
              <label htmlFor="paymentMethodId" className="label-caps text-muted-foreground mb-1">
                Paid from
              </label>
              <select
                id="paymentMethodId"
                name="paymentMethodId"
                required
                defaultValue={methods[0]?.id}
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

            <Field id="spentAt" label="Date" type="date" defaultValue={today} />
            <Field id="description" label="Description (optional)" placeholder="Electricity bill" />

            <DialogFooter className="mt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="border-border text-muted-foreground hover:border-primary hover:text-primary rounded border px-4 py-2.5 text-sm transition-colors"
              >
                Cancel
              </button>
              <Submit label="Record expense" />
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CategoriesDialog({ categories }: { categories: CategoryOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFeedbackAction<ExpenseState, FormData>(createCategory, {}, () => {
    formRef.current?.reset();
  });
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="border-border bg-card text-muted-foreground hover:border-primary hover:text-primary flex items-center gap-2 rounded border px-4 py-2.5 text-sm font-medium transition-colors">
          <Tags className="size-4" aria-hidden="true" />
          Categories
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Expense categories</DialogTitle>
          <DialogDescription>Rent, utilities, salaries, maintenance.</DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={action} className="flex flex-col gap-2" noValidate>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="name" className="label-caps text-muted-foreground mb-1 block">
                Category name
              </label>
              <input
                id="name"
                name="name"
                required
                placeholder="Utilities"
                aria-invalid={state.fieldErrors?.name ? true : undefined}
                className={inputClass}
              />
            </div>
            <Submit label="Add" />
          </div>
          {state.fieldErrors?.name && (
            <p className="text-destructive text-[13px]">{state.fieldErrors.name}</p>
          )}
        </form>

        <div className="border-border max-h-[40vh] overflow-y-auto rounded-lg border">
          {categories.length === 0 ? (
            <p className="text-muted-foreground px-4 py-8 text-center text-[13px]">
              No categories yet.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {categories.map((c) => (
                <li key={c.id} className="px-4 py-2.5 text-sm">
                  {c.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      title="Delete expense"
      className="border-border text-muted-foreground hover:border-destructive hover:text-destructive rounded border p-1.5 transition-colors disabled:opacity-50"
    >
      <Trash2 className="size-3.5" aria-hidden="true" />
      <span className="sr-only">Delete expense</span>
    </button>
  );
}

export function DeleteExpenseButton({ id }: { id: string }) {
  const [, action] = useActionState<ExpenseState, FormData>(deleteExpense, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <DeleteSubmit />
    </form>
  );
}
