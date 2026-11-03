"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { ChevronDown, Clock, Pencil, Plus, Trash2, TriangleAlert, Wallet } from "lucide-react";
import { EditAccess } from "@/components/module-access-provider";
import { FormField } from "@/components/form-field";
import { useFeedbackAction } from "@/components/use-feedback-action";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatMoney } from "@/lib/format";
import { computePayroll, dailyWage } from "@/lib/workers";
import {
  addAdvance,
  addExtraHours,
  deleteAdvance,
  deleteExtraHours,
  deleteWorker,
  payWages,
  saveWorker,
  undoWages,
  type WorkerState,
} from "./actions";

const inputClass =
  "w-full rounded border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary aria-invalid:border-destructive";
const ghostButton =
  "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-[13px] font-medium transition-colors";

export type WorkerView = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  monthlyWage: number;
  extraHoursRate: number;
  isActive: boolean;
};
export type MethodOption = { id: string; name: string };

function Submit({ label, tone = "primary" }: { label: string; tone?: "primary" | "success" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${
        tone === "success" ? "bg-success hover:bg-success/90" : "bg-primary hover:bg-primary-hover"
      } text-primary-foreground rounded px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70`}
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded border px-3 py-2.5 text-[13px]"
    >
      <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
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
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass}
        {...props}
      />
    </FormField>
  );
}

function Footer({
  onCancel,
  label,
  tone,
}: {
  onCancel: () => void;
  label: string;
  tone?: "success";
}) {
  return (
    <DialogFooter className="mt-2">
      <button
        type="button"
        onClick={onCancel}
        className="border-border text-muted-foreground hover:border-primary hover:text-primary rounded border px-4 py-2.5 text-sm transition-colors"
      >
        Cancel
      </button>
      <Submit label={label} tone={tone} />
    </DialogFooter>
  );
}

/** Month picker. The month lives in the URL so the page stays a server component. */
export function MonthSelect({
  value,
  options,
}: {
  value: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <select
      aria-label="Payroll month"
      value={value}
      onChange={(event) => {
        const next = new URLSearchParams(params.toString());
        next.set("month", event.target.value);
        router.push(`${pathname}?${next.toString()}`);
      }}
      className={`${inputClass} w-auto min-w-44 font-medium`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function WorkerFormDialog({ worker, label }: { worker?: WorkerView; label?: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(worker?.isActive ?? true);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useFeedbackAction<WorkerState, FormData>(saveWorker, {}, () => {
    setOpen(false);
    if (!worker) formRef.current?.reset();
  });
  const editing = Boolean(worker);
  const errors = state.fieldErrors;

  return (
    <>
      {editing ? (
        <button
          onClick={() => setOpen(true)}
          title="Edit worker"
          className="border-border text-muted-foreground hover:border-primary hover:text-primary rounded border p-1.5 transition-colors"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Edit {worker?.name}</span>
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary-hover flex items-center gap-2 rounded px-4 py-2.5 text-sm font-medium transition-colors"
        >
          <Plus className="size-4" aria-hidden="true" />
          {label ?? "Add worker"}
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit worker" : "Add worker"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update this worker's details." : "Wages are paid from a payment method."}
            </DialogDescription>
          </DialogHeader>
          <form ref={formRef} action={action} className="flex flex-col gap-4" noValidate>
            <ErrorBanner message={state.error} />
            {worker && <input type="hidden" name="id" value={worker.id} />}
            <input type="hidden" name="isActive" value={String(active)} />
            <Field
              id="name"
              label="Full name"
              required
              autoFocus
              defaultValue={worker?.name}
              placeholder="e.g. Ahmed Khan"
              error={errors?.name}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="role"
                label="Role / position"
                defaultValue={worker?.role ?? ""}
                placeholder="e.g. Trainer"
                error={errors?.role}
              />
              <Field
                id="phone"
                label="Phone"
                inputMode="numeric"
                defaultValue={worker?.phone ?? ""}
                placeholder="03XXXXXXXXX"
                error={errors?.phone}
              />
              <Field
                id="monthlyWage"
                label="Monthly wage (Rs)"
                type="number"
                step="0.01"
                min="0.01"
                required
                defaultValue={worker?.monthlyWage}
                placeholder="30000"
                error={errors?.monthlyWage}
              />
              <Field
                id="extraHoursRate"
                label="Extra-hours rate (Rs/hr)"
                type="number"
                step="0.01"
                min="0"
                defaultValue={worker?.extraHoursRate || ""}
                placeholder="Pre-fills extra hours; 0 = none"
                error={errors?.extraHoursRate}
              />
            </div>
            <div>
              <p className="label-caps text-muted-foreground mb-1">Status</p>
              <div
                role="radiogroup"
                className="border-border grid max-w-xs grid-cols-2 overflow-hidden rounded border"
              >
                {[
                  [true, "Active"],
                  [false, "Inactive"],
                ].map(([value, text]) => (
                  <button
                    key={String(value)}
                    type="button"
                    role="radio"
                    aria-checked={active === value}
                    onClick={() => setActive(value as boolean)}
                    className={`px-3 py-2.5 text-sm font-medium transition-colors ${
                      active === value
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:text-primary"
                    }`}
                  >
                    {text as string}
                  </button>
                ))}
              </div>
            </div>
            <Footer
              onCancel={() => setOpen(false)}
              label={editing ? "Save changes" : "Add worker"}
            />
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MethodPicker({ methods, error }: { methods: MethodOption[]; error?: string }) {
  const [value, setValue] = useState(methods[0]?.id ?? "");
  return (
    <div>
      <p className="label-caps text-muted-foreground mb-1">Paid via</p>
      <input type="hidden" name="paymentMethodId" value={value} />
      <div role="radiogroup" aria-label="Paid via" className="flex flex-wrap gap-2">
        {methods.map((method) => (
          <button
            key={method.id}
            type="button"
            role="radio"
            aria-checked={value === method.id}
            onClick={() => setValue(method.id)}
            className={`rounded border px-3 py-2 text-[13px] font-medium transition-colors ${
              value === method.id
                ? "border-primary bg-primary-tint text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary"
            }`}
          >
            {method.name}
          </button>
        ))}
      </div>
      {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

function NoMethods() {
  return (
    <p className="border-border bg-secondary text-muted-foreground rounded border px-3 py-3 text-[13px]">
      Add a payment method before paying workers.
    </p>
  );
}

function AdvanceDialog({
  worker,
  month,
  monthText,
  methods,
  locked,
}: {
  worker: WorkerView;
  month: string;
  monthText: string;
  methods: MethodOption[];
  locked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useFeedbackAction<WorkerState, FormData>(addAdvance, {}, () => {
    setOpen(false);
    formRef.current?.reset();
  });
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={ghostButton}
        disabled={locked}
        title={locked ? "Wages already paid for this month" : undefined}
      >
        <Plus className="size-3.5" aria-hidden="true" />
        Advance
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Advance — {worker.name}</DialogTitle>
            <DialogDescription>Paid out now and deducted from {monthText} wages.</DialogDescription>
          </DialogHeader>
          {methods.length === 0 ? (
            <NoMethods />
          ) : (
            <form ref={formRef} action={action} className="flex flex-col gap-4" noValidate>
              <ErrorBanner message={state.error} />
              <input type="hidden" name="workerId" value={worker.id} />
              <input type="hidden" name="month" value={month} />
              <Field
                id="amount"
                label="Amount (Rs)"
                type="number"
                step="0.01"
                min="0.01"
                required
                autoFocus
                error={state.fieldErrors?.amount}
              />
              <MethodPicker methods={methods} error={state.fieldErrors?.paymentMethodId} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="paidAt" label="Date" type="date" defaultValue={today()} />
                <Field id="note" label="Note (optional)" placeholder="e.g. Medical" />
              </div>
              <Footer onCancel={() => setOpen(false)} label="Record advance" />
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ExtraHoursDialog({
  worker,
  month,
  monthText,
}: {
  worker: WorkerView;
  month: string;
  monthText: string;
}) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState(worker.extraHoursRate ? String(worker.extraHoursRate) : "");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useFeedbackAction<WorkerState, FormData>(addExtraHours, {}, () => {
    setOpen(false);
    setHours("");
    formRef.current?.reset();
  });
  const amount = Math.round((Number(hours) || 0) * (Number(rate) || 0) * 100) / 100;
  return (
    <>
      <button onClick={() => setOpen(true)} className={ghostButton}>
        <Clock className="size-3.5" aria-hidden="true" />
        Extra hours
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Extra hours — {worker.name}</DialogTitle>
            <DialogDescription>Added to {monthText} wages when you pay them.</DialogDescription>
          </DialogHeader>
          <form ref={formRef} action={action} className="flex flex-col gap-4" noValidate>
            <ErrorBanner message={state.error} />
            <input type="hidden" name="workerId" value={worker.id} />
            <input type="hidden" name="month" value={month} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="hours"
                label="Hours"
                type="number"
                step="0.25"
                min="0.01"
                required
                autoFocus
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                error={state.fieldErrors?.hours}
              />
              <Field
                id="rate"
                label="Rate (Rs/hr)"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                error={state.fieldErrors?.rate}
              />
            </div>
            <Field id="note" label="Note (optional)" placeholder="e.g. Sunday cover" />
            <p className="bg-primary-tint text-primary rounded px-3 py-2 text-[13px] font-medium">
              Adds {formatMoney(amount)} to {monthText} wages
            </p>
            <Footer onCancel={() => setOpen(false)} label="Add hours" />
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export type PayWagesData = {
  extra: number;
  advances: number;
};

function PayWagesDialog({
  worker,
  month,
  monthText,
  methods,
  extra,
  advances,
}: {
  worker: WorkerView;
  month: string;
  monthText: string;
  methods: MethodOption[];
} & PayWagesData) {
  const [open, setOpen] = useState(false);
  const [absent, setAbsent] = useState("");
  const [state, action] = useFeedbackAction<WorkerState, FormData>(payWages, {}, () => {
    setOpen(false);
    setAbsent("");
  });
  const payroll = computePayroll({
    monthlyWage: worker.monthlyWage,
    extra,
    absentDays: Math.min(Math.max(Number(absent) || 0, 0), 31),
    advances,
  });
  const row = (label: string, value: string, tone?: "plus" | "minus" | "strong") => (
    <div
      className={`flex items-center justify-between px-4 py-2.5 text-sm ${
        tone === "strong" ? "bg-secondary font-semibold" : ""
      }`}
    >
      <span>{label}</span>
      <span
        className={`data-mono font-medium ${
          tone === "plus" ? "text-success" : tone === "minus" ? "text-destructive" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-success hover:bg-success/90 text-primary-foreground inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[13px] font-semibold transition-colors"
      >
        <Wallet className="size-3.5" aria-hidden="true" />
        Pay wages
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Pay wages — {worker.name}</DialogTitle>
            <DialogDescription>
              Payroll month: {monthText}. Confirm the amounts below.
            </DialogDescription>
          </DialogHeader>
          {methods.length === 0 ? (
            <NoMethods />
          ) : (
            <form action={action} className="flex flex-col gap-4" noValidate>
              <ErrorBanner message={state.error} />
              <input type="hidden" name="workerId" value={worker.id} />
              <input type="hidden" name="month" value={month} />

              <div className="border-border divide-border divide-y overflow-hidden rounded-lg border">
                {row("Monthly wage", formatMoney(payroll.monthlyWage))}
                {row("+ Extra hours", `+ ${formatMoney(payroll.extra)}`, "plus")}
                {row("− Absence", `− ${formatMoney(payroll.absence)}`, "minus")}
                {row("Adjusted gross", formatMoney(payroll.adjustedGross), "strong")}
                {row("Advances", `− ${formatMoney(payroll.advances)}`, "minus")}
                <div className="bg-success-tint text-success flex items-center justify-between px-4 py-3 font-semibold">
                  <span>Net to pay</span>
                  <span className="data-mono text-lg">{formatMoney(payroll.net)}</span>
                </div>
              </div>

              <Field
                id="absentDays"
                label="Absent days"
                type="number"
                step="0.5"
                min="0"
                max="31"
                placeholder="0"
                value={absent}
                onChange={(e) => setAbsent(e.target.value)}
                hint={`One day's wage = monthly wage ÷ 30 (${formatMoney(dailyWage(worker.monthlyWage))}).`}
                error={state.fieldErrors?.absentDays}
              />
              <MethodPicker methods={methods} error={state.fieldErrors?.paymentMethodId} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="paidAt" label="Payment date" type="date" defaultValue={today()} />
                <Field id="note" label="Notes (optional)" placeholder="e.g. Cash payment" />
              </div>
              <p className="bg-success-tint text-success rounded px-3 py-2 text-[13px]">
                <strong>Cashbook impact:</strong> an outgoing entry of {formatMoney(payroll.net)}{" "}
                from the chosen payment method, recorded as an expense for {monthText}.
              </p>
              <Footer
                onCancel={() => setOpen(false)}
                label={`Pay ${formatMoney(payroll.net)}`}
                tone="success"
              />
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** A destructive action behind a confirmation, submitting `fields` to `action`. */
function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  action,
  fields,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  action: (state: WorkerState, formData: FormData) => Promise<WorkerState>;
  fields: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [, run, pending] = useFeedbackAction<WorkerState, FormData>(action, {}, () =>
    setOpen(false)
  );
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <>
      <span onClick={() => setOpen(true)} className="contents">
        {trigger}
      </span>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <form ref={formRef} action={run}>
            {Object.entries(fields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
          </form>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                formRef.current?.requestSubmit();
              }}
            >
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function UndoWages({ paymentId, monthText }: { paymentId: string; monthText: string }) {
  return (
    <ConfirmAction
      trigger={
        <button type="button" className={ghostButton}>
          Undo
        </button>
      }
      title={`Undo ${monthText} wages?`}
      description="The payment is removed and the money returns to its payment method."
      confirmLabel="Undo payment"
      action={undoWages}
      fields={{ id: paymentId }}
    />
  );
}

function DeleteWorker({ worker }: { worker: WorkerView }) {
  return (
    <ConfirmAction
      trigger={
        <button
          type="button"
          title="Delete worker"
          className="border-border text-muted-foreground hover:border-destructive hover:text-destructive rounded border p-1.5 transition-colors"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Delete {worker.name}</span>
        </button>
      }
      title={`Delete ${worker.name}?`}
      description="Their advances, extra hours and wage history are removed. Money already paid stays in Expenses."
      confirmLabel="Delete worker"
      action={deleteWorker}
      fields={{ id: worker.id }}
    />
  );
}

function DeleteEntry({
  id,
  kind,
  locked,
}: {
  id: string;
  kind: "advance" | "hours";
  locked: boolean;
}) {
  return (
    <ConfirmAction
      trigger={
        <button
          type="button"
          disabled={locked}
          title={locked ? "Undo the wage payment first" : "Remove"}
          className="text-muted-foreground hover:text-destructive disabled:opacity-40"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Remove entry</span>
        </button>
      }
      title={kind === "advance" ? "Remove this advance?" : "Remove these hours?"}
      description={
        kind === "advance"
          ? "The advance is removed and the money returns to its payment method."
          : "They will no longer be added to this month's wages."
      }
      confirmLabel="Remove"
      action={kind === "advance" ? deleteAdvance : deleteExtraHours}
      fields={{ id }}
    />
  );
}

/** Collapsible worker card: `header` is always visible, `children` is the history. */
export function WorkerRowShell({
  header,
  children,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-border bg-card rounded-lg border">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-3">{header}</div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          title="Show details"
          className="border-border text-muted-foreground hover:border-primary hover:text-primary rounded border p-1.5 transition-colors"
        >
          <ChevronDown
            className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
          <span className="sr-only">Toggle details</span>
        </button>
      </div>
      {open && <div className="border-border border-t px-4 py-3">{children}</div>}
    </li>
  );
}

/** All per-worker controls, shown only to users who may edit this module. */
export function WorkerActions(props: {
  worker: WorkerView;
  month: string;
  monthText: string;
  methods: MethodOption[];
  extra: number;
  advances: number;
  paymentId: string | null;
}) {
  const { worker, month, monthText, methods, paymentId } = props;
  return (
    <EditAccess module="workers">
      <div className="flex flex-wrap items-center gap-2">
        {paymentId ? (
          <UndoWages paymentId={paymentId} monthText={monthText} />
        ) : (
          <>
            <PayWagesDialog {...props} />
            <ExtraHoursDialog worker={worker} month={month} monthText={monthText} />
          </>
        )}
        <AdvanceDialog
          worker={worker}
          month={month}
          monthText={monthText}
          methods={methods}
          locked={Boolean(paymentId)}
        />
        <WorkerFormDialog worker={worker} />
        <DeleteWorker worker={worker} />
      </div>
    </EditAccess>
  );
}

export function AddWorkerButton() {
  return (
    <EditAccess module="workers">
      <WorkerFormDialog />
    </EditAccess>
  );
}

export function EntryDelete(props: { id: string; kind: "advance" | "hours"; locked: boolean }) {
  return (
    <EditAccess module="workers">
      <DeleteEntry {...props} />
    </EditAccess>
  );
}
