"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { addMonths, format as formatDateFns } from "date-fns";
import { Plus, TriangleAlert, X } from "lucide-react";
import { DialogFooter } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { PhotoCapture } from "@/components/photo-capture";
import type { ActionState } from "./actions";
import type { PackageOption } from "./data";

const inputClass =
  "w-full rounded border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary aria-invalid:border-destructive";

export type ExtraOption = { id: string; name: string; fee: string };

export type PaymentMethodOption = { id: string; name: string };

export type MemberInitial = {
  membershipId: string;
  name: string;
  phone: string;
  cnic: string | null;
  email: string | null;
  joinDate: string; // yyyy-mm-dd
  packageId: string;
  photoUrl: string | null;
  extraIds: string[];
};

/** yyyy-mm-dd one month on from the given date string. */
function oneMonthAfter(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return formatDateFns(addMonths(d, 1), "yyyy-MM-dd");
}

/** 3600212345678 -> 36002-1234567-8 */
function formatCnic(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 13);
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}

function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="bg-primary text-primary-foreground hover:bg-primary-hover rounded px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

/**
 * The shared body of the add / edit member dialogs.
 *
 * `initial` present => edit mode: the form carries a hidden membershipId, the
 * photo starts from the existing headshot, and the submit relabels.
 */
export function MemberForm({
  state,
  action,
  formRef,
  packages,
  extras,
  paymentMethods = [],
  initial,
  onCancel,
}: {
  state: ActionState;
  action: (formData: FormData) => void;
  formRef: React.RefObject<HTMLFormElement | null>;
  packages: PackageOption[];
  extras: ExtraOption[];
  paymentMethods?: PaymentMethodOption[];
  initial?: MemberInitial;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [method, setMethod] = useState(paymentMethods?.[0]?.id ?? "");
  const editing = Boolean(initial);
  const today = new Date().toISOString().slice(0, 10);

  // The joining payment is only collected on a fresh add.
  const [packageId, setPackageId] = useState(initial?.packageId ?? packages[0]?.id ?? "");
  const [showExtras, setShowExtras] = useState((initial?.extraIds?.length ?? 0) > 0);

  const [cnic, setCnic] = useState(initial?.cnic ?? "");
  // Joining date drives the default renewal date (one month on) until the
  // user overrides it. Add mode only.
  const [joinDate, setJoinDate] = useState(initial?.joinDate ?? today);
  const [renewalDate, setRenewalDate] = useState(() => oneMonthAfter(initial?.joinDate ?? today));
  const [renewalTouched, setRenewalTouched] = useState(false);
  const renewalValue = renewalTouched ? renewalDate : oneMonthAfter(joinDate);
  // In edit mode the existing headshot seeds the preview.
  const [photo, setPhoto] = useState<string | null>(initial?.photoUrl ?? null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoTouched = photo !== (initial?.photoUrl ?? null);

  const [chosenExtraIds, setChosenExtraIds] = useState<string[]>(initial?.extraIds ?? []);
  const [extraToAdd, setExtraToAdd] = useState("");

  const extraById = useMemo(() => new Map(extras.map((e) => [e.id, e])), [extras]);
  const unchosen = extras.filter((e) => !chosenExtraIds.includes(e.id));

  const extrasTotal = chosenExtraIds.reduce(
    (sum, id) => sum + Number(extraById.get(id)?.fee ?? 0),
    0
  );

  const packageFee = Number(packages.find((p) => p.id === packageId)?.price ?? 0);
  // Prefill the joining payment to what the member owes today.
  const [amountPaid, setAmountPaid] = useState<string>("");
  const suggestedAmount = (packageFee + extrasTotal).toFixed(2);
  const [amountTouched, setAmountTouched] = useState(false);
  const amountValue = amountTouched ? amountPaid : suggestedAmount;

  function addExtra() {
    const id = extraToAdd || unchosen[0]?.id;
    if (id && !chosenExtraIds.includes(id)) {
      setChosenExtraIds((cur) => [...cur, id]);
    }
    setExtraToAdd("");
  }

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(event) => {
        if (photoBusy) event.preventDefault();
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      {editing && <input type="hidden" name="membershipId" value={initial!.membershipId} />}

      {state.error && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded border px-3 py-2.5 text-[13px] leading-[18px]"
        >
          <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      )}

      {/*
        Photo field. On a fresh add it is the raw data: URL (or empty). On an
        edit it is: unchanged -> "", replaced -> data: URL, cleared -> "__remove__".
      */}
      <input
        type="hidden"
        name="photo"
        value={
          !editing
            ? (photo ?? "")
            : !photoTouched
              ? ""
              : photo?.startsWith("data:image/")
                ? photo
                : "__remove__"
        }
      />
      <PhotoCapture value={photo} onChange={setPhoto} onBusyChange={setPhotoBusy} />

      <div className="flex flex-col">
        <label htmlFor="name" className="label-caps text-muted-foreground mb-1">
          Full name
        </label>
        <input
          id="name"
          name="name"
          required
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ahsan Raza"
          aria-invalid={state.fieldErrors?.name ? true : undefined}
          className={inputClass}
        />
        {state.fieldErrors?.name && (
          <p className="text-destructive mt-1 text-[13px]">{state.fieldErrors.name}</p>
        )}
      </div>

      <div className="flex flex-col">
        <label htmlFor="cnic" className="label-caps text-muted-foreground mb-1">
          CNIC <span className="font-normal tracking-normal normal-case">(optional)</span>
        </label>
        <input
          id="cnic"
          inputMode="numeric"
          value={formatCnic(cnic)}
          onChange={(e) => setCnic(e.target.value.replace(/\D/g, "").slice(0, 13))}
          placeholder="36002-1234567-8"
          aria-invalid={state.fieldErrors?.cnic ? true : undefined}
          className={inputClass}
        />
        <input type="hidden" name="cnic" value={cnic} />
        {state.fieldErrors?.cnic && (
          <p className="text-destructive mt-1 text-[13px]">{state.fieldErrors.cnic}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col">
          <label htmlFor="phone" className="label-caps text-muted-foreground mb-1">
            WhatsApp number{" "}
            <span className="font-normal tracking-normal normal-case">(Required)</span>
          </label>
          <input
            id="phone"
            name="phone"
            required
            type="tel"
            inputMode="tel"
            maxLength={32}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="03001234567 or +923001234567"
            aria-invalid={state.fieldErrors?.phone ? true : undefined}
            className={inputClass}
          />
          {state.fieldErrors?.phone && (
            <p role="alert" className="text-destructive mt-1 text-[13px]">
              {state.fieldErrors.phone}
            </p>
          )}
        </div>

        <div className="flex flex-col">
          <label htmlFor="joinDate" className="label-caps text-muted-foreground mb-1">
            Joined
          </label>
          <input
            id="joinDate"
            name="joinDate"
            type="date"
            value={joinDate}
            onChange={(e) => setJoinDate(e.target.value)}
            max={today}
            className={inputClass}
          />
        </div>
      </div>

      {!editing && (
        <div className="flex flex-col">
          <label htmlFor="renewalDate" className="label-caps text-muted-foreground mb-1">
            Renewal date
          </label>
          <input
            id="renewalDate"
            name="renewalDate"
            type="date"
            value={renewalValue}
            onChange={(e) => {
              setRenewalTouched(true);
              setRenewalDate(e.target.value);
            }}
            min={joinDate}
            aria-invalid={state.fieldErrors?.renewalDate ? true : undefined}
            className={inputClass}
          />
          <p className="text-muted-foreground mt-1 text-[12px]">
            Defaults to one month after joining. Editable.
          </p>
          {state.fieldErrors?.renewalDate && (
            <p className="text-destructive mt-1 text-[13px]">{state.fieldErrors.renewalDate}</p>
          )}
        </div>
      )}

      <div className="flex flex-col">
        <label htmlFor="email" className="label-caps text-muted-foreground mb-1">
          Email <span className="font-normal tracking-normal normal-case">(optional)</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ahsan@example.com"
          aria-invalid={state.fieldErrors?.email ? true : undefined}
          className={inputClass}
        />
        {state.fieldErrors?.email && (
          <p className="text-destructive mt-1 text-[13px]">{state.fieldErrors.email}</p>
        )}
      </div>

      <div className="flex flex-col">
        <label htmlFor="packageId" className="label-caps text-muted-foreground mb-1">
          Package
        </label>
        <select
          id="packageId"
          name="packageId"
          required
          value={packageId}
          onChange={(e) => setPackageId(e.target.value)}
          aria-invalid={state.fieldErrors?.packageId ? true : undefined}
          className={inputClass}
        >
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {formatMoney(p.price)}
            </option>
          ))}
        </select>
        {state.fieldErrors?.packageId && (
          <p className="text-destructive mt-1 text-[13px]">{state.fieldErrors.packageId}</p>
        )}
      </div>

      {/* Extras: hidden until the member asks for them, then a removable list. */}
      <div className="flex flex-col">
        {!showExtras ? (
          <button
            type="button"
            onClick={() => setShowExtras(true)}
            className="border-border text-muted-foreground hover:border-primary hover:text-primary flex w-fit items-center gap-1 rounded border px-3 py-2 text-sm transition-colors"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add extras
          </button>
        ) : (
          <>
            <label htmlFor="extra-add" className="label-caps text-muted-foreground mb-1">
              Extras <span className="font-normal tracking-normal normal-case">(optional)</span>
            </label>

            {extras.length === 0 ? (
              <p className="border-border bg-secondary text-muted-foreground rounded border px-3 py-2 text-[12px]">
                No extras exist yet. Add them with the Extras button first.
              </p>
            ) : (
              <>
                {/* Each chosen extra rides along as a hidden field. */}
                {chosenExtraIds.map((id) => (
                  <input key={id} type="hidden" name="extraIds" value={id} />
                ))}

                <div className="flex gap-2">
                  <select
                    id="extra-add"
                    value={extraToAdd}
                    onChange={(e) => setExtraToAdd(e.target.value)}
                    disabled={unchosen.length === 0}
                    className={`${inputClass} flex-1 disabled:opacity-50`}
                  >
                    {unchosen.length === 0 ? (
                      <option value="">All extras added</option>
                    ) : (
                      unchosen.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} — {formatMoney(e.fee)}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={addExtra}
                    disabled={unchosen.length === 0}
                    className="border-border text-muted-foreground hover:border-primary hover:text-primary flex shrink-0 items-center gap-1 rounded border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    Add
                  </button>
                </div>

                {chosenExtraIds.length > 0 && (
                  <ul className="divide-border border-border mt-2 flex flex-col divide-y rounded-lg border">
                    {chosenExtraIds.map((id) => {
                      const extra = extraById.get(id);
                      return (
                        <li key={id} className="flex items-center gap-2 px-3 py-2 text-sm">
                          <span className="min-w-0 flex-1 truncate">{extra?.name ?? "—"}</span>
                          <span className="data-mono text-muted-foreground shrink-0">
                            {formatMoney(extra?.fee ?? "0")}
                          </span>
                          <button
                            type="button"
                            onClick={() => setChosenExtraIds((cur) => cur.filter((x) => x !== id))}
                            aria-label={`Remove ${extra?.name ?? "extra"}`}
                            className="text-muted-foreground hover:text-destructive rounded p-0.5 transition-colors"
                          >
                            <X className="size-3.5" aria-hidden="true" />
                          </button>
                        </li>
                      );
                    })}
                    <li className="bg-secondary/50 flex items-center justify-between px-3 py-2 text-sm font-medium">
                      <span>Extras total</span>
                      <span className="data-mono">{formatMoney(extrasTotal)}</span>
                    </li>
                  </ul>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Joining payment - recorded as the member's first renewal. Add mode only. */}
      {!editing && (
        <div className="border-border grid grid-cols-2 gap-4 border-t pt-4">
          <div className="flex flex-col">
            <label htmlFor="amountPaid" className="label-caps text-muted-foreground mb-1">
              Amount paid
            </label>
            <input
              id="amountPaid"
              name="amountPaid"
              type="number"
              min="0"
              step="0.01"
              required
              value={amountValue}
              onChange={(e) => {
                setAmountTouched(true);
                setAmountPaid(e.target.value);
              }}
              aria-invalid={state.fieldErrors?.amountPaid ? true : undefined}
              className={inputClass}
            />
            {state.fieldErrors?.amountPaid && (
              <p className="text-destructive mt-1 text-[13px]">{state.fieldErrors.amountPaid}</p>
            )}
          </div>

          <div className="flex flex-col">
            <label htmlFor="paymentMethodId" className="label-caps text-muted-foreground mb-1">
              Paid by
            </label>
            {paymentMethods.length === 0 ? (
              <p className="border-border bg-secondary text-muted-foreground rounded border px-3 py-2 text-[12px]">
                Add a payment method first.
              </p>
            ) : (
              <select
                id="paymentMethodId"
                name="paymentMethodId"
                required
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                aria-invalid={state.fieldErrors?.paymentMethodId ? true : undefined}
                className={inputClass}
              >
                {paymentMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
            {state.fieldErrors?.paymentMethodId && (
              <p className="text-destructive mt-1 text-[13px]">
                {state.fieldErrors.paymentMethodId}
              </p>
            )}
          </div>
        </div>
      )}

      <DialogFooter className="mt-2">
        <button
          type="button"
          onClick={onCancel}
          className="border-border text-muted-foreground hover:border-primary hover:text-primary rounded border px-4 py-2.5 text-sm transition-colors"
        >
          Cancel
        </button>
        <SubmitButton disabled={photoBusy} label={editing ? "Save changes" : "Add member"} />
      </DialogFooter>
    </form>
  );
}
