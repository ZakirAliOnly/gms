"use client";

import { EditAccess } from "@/components/module-access-provider";

import { useFeedbackAction } from "@/components/use-feedback-action";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil, Tags, Undo2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import type { PackageRow } from "./data";
import { createPackage, togglePackage, updatePackage, type PackageState } from "./package-actions";

const inputClass =
  "w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary aria-invalid:border-destructive";

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary text-primary-foreground hover:bg-primary-hover shrink-0 rounded px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

/** First error across the three fields, so one line covers the form. */
function firstError(state: PackageState) {
  return state.fieldErrors?.name || state.fieldErrors?.price || state.fieldErrors?.whatsIncluded;
}

function ToggleSubmit({ isActive, name }: { isActive: boolean; name: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      title={isActive ? "Retire this package" : "Restore this package"}
      className="border-border text-primary hover:border-primary hover:bg-primary-tint rounded border p-1.5 transition-colors disabled:opacity-50"
    >
      {isActive ? (
        <X className="size-3.5" aria-hidden="true" />
      ) : (
        <Undo2 className="size-3.5" aria-hidden="true" />
      )}
      <span className="sr-only">{isActive ? `Retire ${name}` : `Restore ${name}`}</span>
    </button>
  );
}

function ToggleButton({ pkg }: { pkg: PackageRow }) {
  const [, action] = useActionState<PackageState, FormData>(togglePackage, {});

  return (
    <form action={action}>
      <input type="hidden" name="id" value={pkg.id} />
      <ToggleSubmit isActive={pkg.isActive} name={pkg.name} />
    </form>
  );
}

function EditRow({ pkg, onDone }: { pkg: PackageRow; onDone: () => void }) {
  const [state, action] = useFeedbackAction<PackageState, FormData>(updatePackage, {}, () => {
    onDone();
  });

  return (
    <form action={action} className="flex flex-col gap-2 p-3">
      <input type="hidden" name="id" value={pkg.id} />

      <div className="flex flex-wrap items-start gap-2">
        <input
          name="name"
          defaultValue={pkg.name}
          required
          aria-label="Package name"
          className={`${inputClass} min-w-0 flex-1`}
        />
        <input
          name="price"
          type="number"
          step="0.01"
          min="0"
          defaultValue={pkg.price}
          required
          aria-label="Fee"
          className={`${inputClass} w-28`}
        />
      </div>

      <textarea
        name="whatsIncluded"
        rows={2}
        defaultValue={pkg.whatsIncluded ?? ""}
        placeholder="What's included…"
        aria-label="What's included"
        className={inputClass}
      />

      <div className="flex items-center gap-2">
        <SaveButton label="Save" />
        <button
          type="button"
          onClick={onDone}
          className="border-border text-muted-foreground hover:border-primary hover:text-primary shrink-0 rounded border px-3 py-2 text-sm transition-colors"
        >
          Cancel
        </button>
      </div>

      {firstError(state) && <p className="text-destructive text-[13px]">{firstError(state)}</p>}
    </form>
  );
}

function PackagesDialogContent({ packages }: { packages: PackageRow[] }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [state, action] = useFeedbackAction<PackageState, FormData>(createPackage, {}, () => {
    formRef.current?.reset();
  });
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="border-primary bg-card text-primary hover:bg-primary hover:text-primary-foreground flex items-center gap-2 rounded border px-4 py-2.5 text-sm font-medium transition-colors">
          <Tags className="size-4" aria-hidden="true" />
          Packages
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Packages</DialogTitle>
          <DialogDescription>
            Membership plans and their monthly fee. These appear when adding a member.
          </DialogDescription>
        </DialogHeader>

        {/* Add */}
        <form ref={formRef} action={action} className="flex flex-col gap-2" noValidate>
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="pkg-name" className="label-caps text-muted-foreground mb-1 block">
                Package name
              </label>
              <input
                id="pkg-name"
                name="name"
                required
                placeholder="Monthly"
                aria-invalid={state.fieldErrors?.name ? true : undefined}
                className={inputClass}
              />
            </div>
            <div className="w-32">
              <label htmlFor="pkg-price" className="label-caps text-muted-foreground mb-1 block">
                Fee (PKR)
              </label>
              <input
                id="pkg-price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="4000"
                aria-invalid={state.fieldErrors?.price ? true : undefined}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="pkg-included" className="label-caps text-muted-foreground mb-1 block">
              What&rsquo;s included{" "}
              <span className="font-normal tracking-normal normal-case">(optional)</span>
            </label>
            <textarea
              id="pkg-included"
              name="whatsIncluded"
              rows={2}
              placeholder="Gym floor, group classes, one guest pass a month…"
              aria-invalid={state.fieldErrors?.whatsIncluded ? true : undefined}
              className={inputClass}
            />
          </div>

          <div className="flex items-center gap-2">
            <SaveButton label="Add package" />
            {firstError(state) && (
              <p className="text-destructive text-[13px]">{firstError(state)}</p>
            )}
          </div>
        </form>

        {/* List */}
        <div className="border-border max-h-[45vh] overflow-y-auto rounded-lg border">
          {packages.length === 0 ? (
            <p className="text-muted-foreground px-4 py-8 text-center text-[13px]">
              No packages yet. Add one above to start enrolling members.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {packages.map((pkg) =>
                editingId === pkg.id ? (
                  <li key={pkg.id} className="bg-secondary/40">
                    <EditRow pkg={pkg} onDone={() => setEditingId(null)} />
                  </li>
                ) : (
                  <li
                    key={pkg.id}
                    className={`flex items-start gap-3 px-4 py-3 ${
                      pkg.isActive ? "" : "opacity-60"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {pkg.name}
                        {!pkg.isActive && (
                          <span className="bg-secondary text-muted-foreground ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                            Retired
                          </span>
                        )}
                      </p>
                      {pkg.whatsIncluded && (
                        <p className="text-muted-foreground mt-0.5 text-[13px] leading-[18px]">
                          {pkg.whatsIncluded}
                        </p>
                      )}
                      {pkg.memberCount > 0 && (
                        <p className="text-muted-foreground mt-0.5 text-[12px]">
                          {pkg.memberCount} member{pkg.memberCount === 1 ? "" : "s"}
                        </p>
                      )}
                    </div>

                    <p className="data-mono shrink-0 text-sm font-medium">
                      {formatMoney(pkg.price)}
                    </p>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(pkg.id)}
                        title="Edit"
                        className="border-border text-primary hover:border-primary hover:bg-primary-tint rounded border p-1.5 transition-colors"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                        <span className="sr-only">Edit {pkg.name}</span>
                      </button>
                      <ToggleButton pkg={pkg} />
                    </div>
                  </li>
                )
              )}
            </ul>
          )}
        </div>

        <p className="text-muted-foreground text-[13px] leading-[18px]">
          Retiring a package hides it when adding members. Existing memberships keep it, so history
          and reports stay intact.
        </p>
      </DialogContent>
    </Dialog>
  );
}

export function PackagesDialog(props: React.ComponentProps<typeof PackagesDialogContent>) {
  return (
    <EditAccess module="memberships">
      <PackagesDialogContent {...props} />
    </EditAccess>
  );
}
