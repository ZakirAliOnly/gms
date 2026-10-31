"use client";

import { EditAccess } from "@/components/module-access-provider";

import { FormField } from "@/components/form-field";

import { useFeedbackAction } from "@/components/use-feedback-action";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createSupplier, updateSupplier, type SupplierState } from "./actions";
import type { SupplierRow } from "./data";

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

function SupplierForm({
  state,
  action,
  formRef,
  supplier,
  onCancel,
  submitLabel,
}: {
  state: SupplierState;
  action: (formData: FormData) => void;
  formRef: React.RefObject<HTMLFormElement | null>;
  supplier?: SupplierRow;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4" noValidate>
      {supplier && <input type="hidden" name="id" value={supplier.id} />}

      {state.error && <p className="text-destructive text-[13px]">{state.error}</p>}

      <Field
        id="name"
        label="Name"
        required
        autoFocus
        defaultValue={supplier?.name}
        placeholder="Nutrition Depot"
        error={state.fieldErrors?.name}
      />

      <div className="grid grid-cols-2 gap-4">
        <Field
          id="phone"
          label="Phone"
          inputMode="numeric"
          maxLength={11}
          pattern="\d{11}"
          defaultValue={supplier?.phone ?? ""}
          placeholder="03001234567"
          error={state.fieldErrors?.phone}
        />
        <Field
          id="email"
          label="Email"
          type="email"
          defaultValue={supplier?.email ?? ""}
          placeholder="sales@example.com"
          error={state.fieldErrors?.email}
        />
      </div>

      <Field
        id="address"
        label="Address"
        defaultValue={supplier?.address ?? ""}
        error={state.fieldErrors?.address}
      />

      <div className="flex flex-col">
        <label htmlFor="notes" className="label-caps text-muted-foreground mb-1">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={supplier?.notes ?? ""}
          className={inputClass}
        />
      </div>

      <DialogFooter className="mt-2">
        <button
          type="button"
          onClick={onCancel}
          className="border-border text-muted-foreground hover:border-primary hover:text-primary rounded border px-4 py-2.5 text-sm transition-colors"
        >
          Cancel
        </button>
        <Submit label={submitLabel} />
      </DialogFooter>
    </form>
  );
}

function AddSupplierDialogContent() {
  const [open, setOpen] = useState(false);
  const [state, action] = useFeedbackAction<SupplierState, FormData>(createSupplier, {}, () => {
    setOpen(false);
    formRef.current?.reset();
  });
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="bg-primary text-primary-foreground hover:bg-primary-hover flex items-center gap-2 rounded px-4 py-2.5 text-sm font-medium transition-colors">
          <Plus className="size-4" aria-hidden="true" />
          New supplier
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New supplier</DialogTitle>
          <DialogDescription>Who you buy retail stock from.</DialogDescription>
        </DialogHeader>
        <SupplierForm
          state={state}
          action={action}
          formRef={formRef}
          onCancel={() => setOpen(false)}
          submitLabel="Add supplier"
        />
      </DialogContent>
    </Dialog>
  );
}

function EditSupplierDialogContent({ supplier }: { supplier: SupplierRow }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFeedbackAction<SupplierState, FormData>(updateSupplier, {}, () => {
    setOpen(false);
  });
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          title="Edit"
          className="border-border text-primary hover:border-primary hover:bg-primary-tint rounded border p-1.5 transition-colors"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Edit {supplier.name}</span>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Edit supplier</DialogTitle>
          <DialogDescription>{supplier.name}</DialogDescription>
        </DialogHeader>
        <SupplierForm
          state={state}
          action={action}
          formRef={formRef}
          supplier={supplier}
          onCancel={() => setOpen(false)}
          submitLabel="Save"
        />
      </DialogContent>
    </Dialog>
  );
}

export function AddSupplierDialog() {
  return (
    <EditAccess module="suppliers">
      <AddSupplierDialogContent />
    </EditAccess>
  );
}
export function EditSupplierDialog(props: React.ComponentProps<typeof EditSupplierDialogContent>) {
  return (
    <EditAccess module="suppliers">
      <EditSupplierDialogContent {...props} />
    </EditAccess>
  );
}
