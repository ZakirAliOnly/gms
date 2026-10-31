"use client";
import { useState, useTransition } from "react";
import { Printer } from "lucide-react";
import { getPaymentReceipt } from "./actions";
import { InvoiceDialog } from "../invoices/invoice-dialog";
import type { InvoiceReceipt } from "../invoices/invoice-receipt";
export function PaymentReceiptButton({ id }: { id: string }) {
  const [invoice, setInvoice] = useState<InvoiceReceipt | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <button
        type="button"
        className="dashboard-action"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError("");
            try {
              const result = await getPaymentReceipt(id);
              if (result.invoice) setInvoice(result.invoice);
              else setError(result.error ?? "Receipt could not load.");
            } catch {
              setError("Receipt could not load. Please try again.");
            }
          })
        }
      >
        <Printer className="size-4" aria-hidden="true" />
        {pending ? "Loading…" : "Receipt"}
      </button>
      {error && (
        <span role="alert" className="text-destructive text-xs">
          {error}
        </span>
      )}
      {invoice && (
        <InvoiceDialog
          invoice={invoice}
          open
          onOpenChange={(open) => {
            if (!open) setInvoice(null);
          }}
        />
      )}
    </>
  );
}
