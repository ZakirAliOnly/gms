"use client";

import { EditAccess } from "@/components/module-access-provider";

import { FormField } from "@/components/form-field";

import { useFeedbackAction } from "@/components/use-feedback-action";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil, Plus, SlidersHorizontal, TriangleAlert, Undo2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  adjustStock,
  createProduct,
  toggleProduct,
  updateProduct,
  type ProductState,
} from "./actions";
import { ProductPhotoField } from "./product-photo-field";
import { serialLabel } from "@/lib/serial";

const inputClass =
  "w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary aria-invalid:border-destructive";

export type ProductRow = {
  id: string;
  serial: number;
  name: string;
  category: string | null;
  photoUrl: string | null;
  costPrice: string;
  salePrice: string;
  quantity: number;
  reorderLevel: number;
  isActive: boolean;
};

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

/** Add a product. */
function AddProductDialogContent() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Remount the form after each add so the photo field resets.
  const [formKey, setFormKey] = useState(0);
  const [state, action] = useFeedbackAction<ProductState, FormData>(createProduct, {}, () => {
    setOpen(false);
    formRef.current?.reset();
    setFormKey((k) => k + 1);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="bg-primary text-primary-foreground hover:bg-primary-hover flex items-center gap-2 rounded px-4 py-2.5 text-sm font-medium transition-colors">
          <Plus className="size-4" aria-hidden="true" />
          New product
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New product</DialogTitle>
          <DialogDescription>
            Retail stock sold at the front desk. A serial number is assigned automatically — use it,
            or the name, to find the product at the till.
          </DialogDescription>
        </DialogHeader>

        <form
          key={formKey}
          ref={formRef}
          action={action}
          className="flex flex-col gap-4"
          noValidate
        >
          <ProductPhotoField name="photo" error={state.fieldErrors?.photo} />

          <Field
            id="name"
            label="Name"
            required
            autoFocus
            placeholder="Whey Protein 1kg"
            error={state.fieldErrors?.name}
          />

          <Field
            id="category"
            label="Category"
            placeholder="Supplements"
            hint="Optional"
            error={state.fieldErrors?.category}
          />

          <div className="grid grid-cols-2 gap-4">
            <Field
              id="costPrice"
              label="Cost price (PKR)"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="7000"
              error={state.fieldErrors?.costPrice}
            />
            <Field
              id="salePrice"
              label="Sale price (PKR)"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="9500"
              error={state.fieldErrors?.salePrice}
            />
          </div>

          <Field
            id="quantity"
            label="Stock"
            type="number"
            min="0"
            required
            defaultValue={0}
            error={state.fieldErrors?.quantity}
          />

          {/* Set the reorder level later by editing the product. */}
          <input type="hidden" name="reorderLevel" value={0} />

          {state.error && <p className="text-destructive text-[13px]">{state.error}</p>}

          <DialogFooter className="mt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="border-border text-muted-foreground hover:border-primary hover:text-primary rounded border px-4 py-2.5 text-sm transition-colors"
            >
              Cancel
            </button>
            <Submit label="Add product" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Edit details. Quantity is not editable here - stock moves via adjustments. */
function EditProductDialogContent({ product }: { product: ProductRow }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFeedbackAction<ProductState, FormData>(updateProduct, {}, () => {
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
          <span className="sr-only">Edit {product.name}</span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit product</DialogTitle>
          <DialogDescription>
            Serial {serialLabel(product.serial)}. Stock is changed through adjustments, so every
            count has a reason behind it.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="id" value={product.id} />
          <input type="hidden" name="quantity" value={product.quantity} />

          <ProductPhotoField
            name="photo"
            editing
            initialUrl={product.photoUrl}
            error={state.fieldErrors?.photo}
          />

          <Field
            id="name"
            label="Name"
            required
            defaultValue={product.name}
            error={state.fieldErrors?.name}
          />

          <Field
            id="category"
            label="Category"
            defaultValue={product.category ?? ""}
            error={state.fieldErrors?.category}
          />

          <div className="grid grid-cols-2 gap-4">
            <Field
              id="costPrice"
              label="Cost price (PKR)"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={product.costPrice}
              error={state.fieldErrors?.costPrice}
            />
            <Field
              id="salePrice"
              label="Sale price (PKR)"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={product.salePrice}
              error={state.fieldErrors?.salePrice}
            />
          </div>

          <Field
            id="reorderLevel"
            label="Reorder at"
            type="number"
            min="0"
            required
            defaultValue={product.reorderLevel}
            error={state.fieldErrors?.reorderLevel}
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

/** Record a stock correction with a reason (FR-27). */
function AdjustStockDialogContent({ product }: { product: ProductRow }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFeedbackAction<ProductState, FormData>(adjustStock, {}, () => {
    setOpen(false);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          title="Adjust stock"
          className="border-border text-primary hover:border-primary hover:bg-primary-tint rounded border p-1.5 transition-colors"
        >
          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Adjust stock for {product.name}</span>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {product.name} — {product.quantity} in stock
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="id" value={product.id} />

          <Field
            id="delta"
            label="Change"
            type="number"
            required
            autoFocus
            placeholder="-2"
            hint="Negative to remove, positive to add."
            error={state.fieldErrors?.delta}
          />
          <Field
            id="reason"
            label="Reason"
            required
            placeholder="Damaged in storage"
            error={state.fieldErrors?.reason}
          />

          {state.error && (
            <div role="alert" className="text-destructive flex items-start gap-2 text-[13px]">
              <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
              <span>{state.error}</span>
            </div>
          )}

          <DialogFooter className="mt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="border-border text-muted-foreground hover:border-primary hover:text-primary rounded border px-4 py-2.5 text-sm transition-colors"
            >
              Cancel
            </button>
            <Submit label="Record" />
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
      title={isActive ? "Hide from catalog" : "Restore to catalog"}
      className="border-border text-primary hover:border-primary hover:bg-primary-tint rounded border p-1.5 transition-colors disabled:opacity-50"
    >
      {isActive ? (
        <X className="size-3.5" aria-hidden="true" />
      ) : (
        <Undo2 className="size-3.5" aria-hidden="true" />
      )}
      <span className="sr-only">{isActive ? `Hide ${name}` : `Restore ${name}`}</span>
    </button>
  );
}

function ToggleProductButtonContent({ product }: { product: ProductRow }) {
  const [, action] = useActionState<ProductState, FormData>(toggleProduct, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={product.id} />
      <ToggleSubmit isActive={product.isActive} name={product.name} />
    </form>
  );
}

export function AddProductDialog() {
  return (
    <EditAccess module="inventory">
      <AddProductDialogContent />
    </EditAccess>
  );
}
export function EditProductDialog(props: React.ComponentProps<typeof EditProductDialogContent>) {
  return (
    <EditAccess module="inventory">
      <EditProductDialogContent {...props} />
    </EditAccess>
  );
}
export function AdjustStockDialog(props: React.ComponentProps<typeof AdjustStockDialogContent>) {
  return (
    <EditAccess module="inventory">
      <AdjustStockDialogContent {...props} />
    </EditAccess>
  );
}
export function ToggleProductButton(
  props: React.ComponentProps<typeof ToggleProductButtonContent>
) {
  return (
    <EditAccess module="inventory">
      <ToggleProductButtonContent {...props} />
    </EditAccess>
  );
}
