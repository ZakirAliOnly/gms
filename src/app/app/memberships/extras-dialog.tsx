"use client";

import { EditAccess } from "@/components/module-access-provider";

import { useFeedbackAction } from "@/components/use-feedback-action";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Package, Pencil, Undo2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import type { ExtraRow } from "./data";
import { createExtra, toggleExtra, updateExtra, type ExtraState } from "./extra-actions";

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

function firstError(state: ExtraState) {
  return state.fieldErrors?.name || state.fieldErrors?.fee;
}

function ToggleSubmit({ isActive, name }: { isActive: boolean; name: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      title={isActive ? "Retire this extra" : "Restore this extra"}
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

function ToggleButton({ extra }: { extra: ExtraRow }) {
  const [, action] = useActionState<ExtraState, FormData>(toggleExtra, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={extra.id} />
      <ToggleSubmit isActive={extra.isActive} name={extra.name} />
    </form>
  );
}

function EditRow({ extra, onDone }: { extra: ExtraRow; onDone: () => void }) {
  const [state, action] = useFeedbackAction<ExtraState, FormData>(updateExtra, {}, () => {
    onDone();
  });

  return (
    <form action={action} className="flex flex-wrap items-start gap-2 p-3">
      <input type="hidden" name="id" value={extra.id} />
      <input
        name="name"
        defaultValue={extra.name}
        required
        aria-label="Extra name"
        className={`${inputClass} min-w-0 flex-1`}
      />
      <input
        name="fee"
        type="number"
        step="0.01"
        min="0"
        defaultValue={extra.fee}
        required
        aria-label="Fee"
        className={`${inputClass} w-28`}
      />
      <SaveButton label="Save" />
      <button
        type="button"
        onClick={onDone}
        className="border-border text-muted-foreground hover:border-primary hover:text-primary shrink-0 rounded border px-3 py-2 text-sm transition-colors"
      >
        Cancel
      </button>
      {firstError(state) && (
        <p className="text-destructive w-full text-[13px]">{firstError(state)}</p>
      )}
    </form>
  );
}

function ExtrasDialogContent({ extras }: { extras: ExtraRow[] }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [state, action] = useFeedbackAction<ExtraState, FormData>(createExtra, {}, () => {
    formRef.current?.reset();
  });
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="border-primary bg-card text-primary hover:bg-primary hover:text-primary-foreground flex items-center gap-2 rounded border px-4 py-2.5 text-sm font-medium transition-colors">
          <Package className="size-4" aria-hidden="true" />
          Extras
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Extras</DialogTitle>
          <DialogDescription>
            Paid add-ons a member can take on top of their package — locker, towel service, personal
            training. Charged monthly with the renewal.
          </DialogDescription>
        </DialogHeader>

        {/* Add */}
        <form ref={formRef} action={action} className="flex flex-col gap-2" noValidate>
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="extra-name" className="label-caps text-muted-foreground mb-1 block">
                Extra name
              </label>
              <input
                id="extra-name"
                name="name"
                required
                placeholder="Locker"
                aria-invalid={state.fieldErrors?.name ? true : undefined}
                className={inputClass}
              />
            </div>
            <div className="w-32">
              <label htmlFor="extra-fee" className="label-caps text-muted-foreground mb-1 block">
                Fee (PKR)
              </label>
              <input
                id="extra-fee"
                name="fee"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="500"
                aria-invalid={state.fieldErrors?.fee ? true : undefined}
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SaveButton label="Add extra" />
            {firstError(state) && (
              <p className="text-destructive text-[13px]">{firstError(state)}</p>
            )}
          </div>
        </form>

        {/* List */}
        <div className="border-border max-h-[45vh] overflow-y-auto rounded-lg border">
          {extras.length === 0 ? (
            <p className="text-muted-foreground px-4 py-8 text-center text-[13px]">
              No extras yet. Add one above.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {extras.map((extra) =>
                editingId === extra.id ? (
                  <li key={extra.id} className="bg-secondary/40">
                    <EditRow extra={extra} onDone={() => setEditingId(null)} />
                  </li>
                ) : (
                  <li
                    key={extra.id}
                    className={`flex items-center gap-3 px-4 py-3 ${
                      extra.isActive ? "" : "opacity-60"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {extra.name}
                        {!extra.isActive && (
                          <span className="bg-secondary text-muted-foreground ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                            Retired
                          </span>
                        )}
                      </p>
                      {extra.memberCount > 0 && (
                        <p className="text-muted-foreground text-[12px]">
                          {extra.memberCount} member{extra.memberCount === 1 ? "" : "s"}
                        </p>
                      )}
                    </div>
                    <p className="data-mono shrink-0 text-sm font-medium">
                      {formatMoney(extra.fee)}
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(extra.id)}
                        title="Edit"
                        className="border-border text-primary hover:border-primary hover:bg-primary-tint rounded border p-1.5 transition-colors"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                        <span className="sr-only">Edit {extra.name}</span>
                      </button>
                      <ToggleButton extra={extra} />
                    </div>
                  </li>
                )
              )}
            </ul>
          )}
        </div>

        <p className="text-muted-foreground text-[13px] leading-[18px]">
          A retired extra stays on the members who already have it — their fee is locked in from
          when it was added.
        </p>
      </DialogContent>
    </Dialog>
  );
}

export function ExtrasDialog(props: React.ComponentProps<typeof ExtrasDialogContent>) {
  return (
    <EditAccess module="memberships">
      <ExtrasDialogContent {...props} />
    </EditAccess>
  );
}
