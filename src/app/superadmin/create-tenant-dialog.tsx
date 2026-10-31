"use client";

import { FormField } from "@/components/form-field";

import { useFeedbackAction } from "@/components/use-feedback-action";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createTenant, type CreateTenantState } from "./actions";

const inputClass =
  "w-full rounded border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary aria-invalid:border-destructive";

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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-ring rounded px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Creating…" : "Create tenant"}
    </button>
  );
}

export function CreateTenantDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFeedbackAction<CreateTenantState, FormData>(
    createTenant,
    {},
    () => {
      setOpen(false);
      formRef.current?.reset();
    }
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Close and reset once the server confirms the tenant was created.

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-ring flex items-center gap-2 rounded px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
          <Plus className="size-4" aria-hidden="true" />
          New tenant
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>New tenant</DialogTitle>
          <DialogDescription>
            Provisions an empty management system and its single login account.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-4" noValidate>
          {state.error && (
            <div
              role="alert"
              className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded border px-3 py-2.5 text-[13px] leading-[18px]"
            >
              <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
              <span>{state.error}</span>
            </div>
          )}

          <Field
            id="name"
            label="Gym name"
            placeholder="Downtown Gym"
            required
            autoFocus
            error={state.fieldErrors?.name}
          />
          <Field
            id="location"
            label="Location"
            placeholder="Gulberg III, Lahore"
            required
            error={state.fieldErrors?.location}
          />

          <div className="border-border border-t pt-4">
            <p className="label-caps text-muted-foreground mb-3">Login details</p>
            <div className="flex flex-col gap-4">
              <Field
                id="email"
                label="Email"
                type="email"
                autoComplete="off"
                placeholder="manager@example.com"
                required
                error={state.fieldErrors?.email}
              />
              <Field
                id="password"
                label="Password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                required
                error={state.fieldErrors?.password}
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
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
