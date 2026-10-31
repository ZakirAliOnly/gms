"use client";

import { EditAccess } from "@/components/module-access-provider";

import { useActionState, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createMembership, type ActionState } from "./actions";
import type { PackageOption } from "./data";
import { BarcodeDialog, type BarcodeTarget } from "@/components/barcode-dialog";
import { InvoiceDialog } from "../invoices/invoice-dialog";
import type { InvoiceReceipt } from "../invoices/invoice-receipt";
import { MemberForm, type ExtraOption, type PaymentMethodOption } from "./member-form";

function AddMemberDialogContent({
  packages,
  extras,
  paymentMethods,
  initiallyOpen = false,
}: {
  packages: PackageOption[];
  extras: ExtraOption[];
  paymentMethods: PaymentMethodOption[];
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const formRef = useRef<HTMLFormElement>(null);
  const [justCreated, setJustCreated] = useState<BarcodeTarget | null>(null);
  const [receipt, setReceipt] = useState<InvoiceReceipt | null>(null);
  // Remount the form after each successful add so its internal state resets.
  const [formKey, setFormKey] = useState(0);

  const [state, formAction] = useActionState<ActionState, FormData>(async (previous, formData) => {
    const result = await createMembership(previous, formData);
    if (result.ok) {
      setReceipt(result.receipt ?? null);
      setOpen(false);
      formRef.current?.reset();
      setFormKey((key) => key + 1);
      if (result.created) {
        setJustCreated({
          title: result.created.memberName,
          barcode: result.created.barcode,
          subtitle: result.created.packageName,
        });
      }
    }
    return result;
  }, {});

  const noPackages = packages.length === 0;
  const noMethods = paymentMethods.length === 0;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="bg-primary text-primary-foreground hover:bg-primary-hover flex items-center gap-2 rounded px-4 py-2.5 text-sm font-medium transition-colors">
            <Plus className="size-4" aria-hidden="true" />
            New member
          </button>
        </DialogTrigger>

        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>New member</DialogTitle>
            <DialogDescription>
              Creates the member and their membership. A barcode is generated automatically.
            </DialogDescription>
          </DialogHeader>

          {noPackages ? (
            <div className="border-border bg-secondary text-muted-foreground rounded border px-3 py-3 text-[13px] leading-[18px]">
              No packages exist yet. Add a package before enrolling members.
            </div>
          ) : noMethods ? (
            <div className="border-border bg-secondary text-muted-foreground rounded border px-3 py-3 text-[13px] leading-[18px]">
              No payment methods exist yet. Add one before enrolling members so the joining payment
              can be recorded.
            </div>
          ) : (
            <MemberForm
              key={formKey}
              state={state}
              action={formAction}
              formRef={formRef}
              packages={packages}
              extras={extras}
              paymentMethods={paymentMethods}
              onCancel={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {receipt && (
        <InvoiceDialog
          key={receipt.number}
          invoice={receipt}
          open={true}
          onOpenChange={(next) => !next && setReceipt(null)}
        />
      )}
      <BarcodeDialog
        target={justCreated}
        open={justCreated !== null && receipt === null}
        onOpenChange={(next) => !next && setJustCreated(null)}
        heading="Member added"
        description="Print the barcode now, or find it later from the member's row."
      />
    </>
  );
}

export function AddMemberDialog(props: React.ComponentProps<typeof AddMemberDialogContent>) {
  return (
    <EditAccess module="memberships">
      <AddMemberDialogContent {...props} />
    </EditAccess>
  );
}
