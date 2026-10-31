"use client";
import { useModuleAccess } from "@/components/module-access-provider";

import { useState, useTransition } from "react";
import { Search, Pencil, Printer, Trash2 } from "lucide-react";
import { formatDate, formatMoneyPrecise } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { EditableInvoice } from "@/lib/invoice-management";
import { InvoiceEditDialog, type InvoiceOptions } from "./invoice-edit-dialog";
import { InvoiceDialog } from "./invoice-dialog";
import { getInvoiceDetails, deleteInvoice } from "./history-actions";

type InvoiceRow = {
  id: string;
  number: string;
  soldAt: string;
  total: string;
  customer: string;
  paymentMethod: string;
};

export function InvoiceHistory({
  invoices,
  ...options
}: { invoices: InvoiceRow[] } & InvoiceOptions) {
  const access = useModuleAccess();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{
    mode: "edit" | "delete" | "print";
    invoice: EditableInvoice;
  } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const search = query.trim().toLowerCase();
  const matches = invoices.filter((invoice) => invoice.number.toLowerCase().includes(search));

  async function openInvoice(id: string, mode: "edit" | "delete" | "print") {
    setLoadingId(id);
    setError(null);
    setDeleteError(null);
    try {
      const result = await getInvoiceDetails(id);
      if (result.invoice) setSelected({ mode, invoice: result.invoice });
      else setError(result.error ?? "Could not load the invoice.");
    } catch {
      setError("Could not load the invoice. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

  function confirmDelete() {
    if (!selected || pending) return;
    const invoice = selected.invoice;
    setDeleteError(null);
    startTransition(async () => {
      try {
        const result = await deleteInvoice({ id: invoice.id, version: invoice.version });
        if ("error" in result) setDeleteError(result.error);
        else setSelected(null);
      } catch {
        setDeleteError("Could not delete the invoice. Please try again.");
      }
    });
  }

  return (
    <section className="border-border mt-10 border-t pt-6" aria-labelledby="invoice-history-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="invoice-history-title" className="text-lg font-semibold">
            Invoice history
          </h2>
          <p className="text-muted-foreground mt-1 text-[13px]" role="status">
            {search
              ? `${matches.length} of ${invoices.length} invoices`
              : `${invoices.length} invoices · Newest first`}
          </p>
        </div>
        <div className="w-full sm:max-w-sm">
          <label htmlFor="invoice-search" className="label-caps text-muted-foreground mb-1 block">
            Search by invoice number
          </label>
          <div className="relative">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-3 left-3 size-4"
              aria-hidden="true"
            />
            <input
              id="invoice-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Enter all or part of an invoice number"
              className="border-input bg-background focus:border-primary focus:ring-primary w-full rounded border py-2.5 pr-3 pl-9 text-sm outline-none focus:ring-1"
            />
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-destructive mt-4 text-sm">
          {error}
        </p>
      )}
      {loadingId && (
        <p role="status" className="text-muted-foreground mt-3 text-sm">
          Loading invoice…
        </p>
      )}
      {matches.length === 0 ? (
        <div className="border-border bg-card mt-4 rounded border px-4 py-10 text-center">
          <p className="text-sm font-medium">
            {invoices.length ? "No matching invoices" : "No invoices yet"}
          </p>
          <p className="text-muted-foreground mt-1 text-[13px]">
            {invoices.length
              ? "Try another invoice number or clear your search."
              : "Completed sales will appear here."}
          </p>
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-primary focus-visible:outline-primary mt-3 rounded px-3 py-2 text-sm hover:underline focus-visible:outline-2"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="border-border bg-card mt-4 overflow-x-auto rounded border">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <caption className="sr-only">Created invoices, newest first</caption>
            <thead>
              <tr className="border-border bg-primary-tint border-b">
                {["Invoice number", "Date", "Customer", "Payment method", "Total", "Actions"].map(
                  (label) => (
                    <th
                      key={label}
                      scope="col"
                      className={`label-caps text-muted-foreground px-4 py-3 ${label === "Total" ? "text-right" : ""}`}
                    >
                      {label}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {matches.map((invoice) => (
                <tr key={invoice.id} className="border-border border-b last:border-0">
                  <th scope="row" className="data-mono px-4 py-3 font-medium">
                    {invoice.number}
                  </th>
                  <td className="data-mono text-muted-foreground px-4 py-3 whitespace-nowrap">
                    {formatDate(new Date(invoice.soldAt))}
                  </td>
                  <td className="px-4 py-3 text-sm">{invoice.customer}</td>
                  <td className="text-muted-foreground px-4 py-3 text-sm">
                    {invoice.paymentMethod}
                  </td>
                  <td className="data-mono px-4 py-3 text-right font-medium whitespace-nowrap">
                    {formatMoneyPrecise(invoice.total)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {(
                        [
                          { mode: "edit", label: "Edit", Icon: Pencil },
                          { mode: "print", label: "Print", Icon: Printer },
                          { mode: "delete", label: "Delete", Icon: Trash2 },
                        ] as const
                      )
                        .filter(
                          (item) => item.mode === "print" || access.editable.includes("invoices")
                        )
                        .map(({ mode, label, Icon }) => (
                          <button
                            key={mode}
                            type="button"
                            disabled={loadingId !== null || pending}
                            onClick={() => openInvoice(invoice.id, mode)}
                            aria-label={`${label} ${invoice.number}`}
                            className={`border-border focus-visible:outline-primary flex items-center gap-1.5 rounded border px-2 py-2 text-xs focus-visible:outline-2 disabled:opacity-50 ${mode === "delete" ? "text-destructive hover:border-destructive" : "text-primary hover:border-primary"}`}
                          >
                            <Icon className="size-3.5" aria-hidden="true" />
                            {label}
                          </button>
                        ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected?.mode === "edit" && (
        <InvoiceEditDialog
          key={selected.invoice.id}
          invoice={selected.invoice}
          {...options}
          onClose={() => setSelected(null)}
        />
      )}
      {selected?.mode === "print" && (
        <InvoiceDialog
          key={selected.invoice.id}
          invoice={selected.invoice.receipt}
          open
          onOpenChange={(open) => !open && setSelected(null)}
        />
      )}
      <Dialog
        open={selected?.mode === "delete"}
        onOpenChange={(open) => {
          if (!open && !pending) setSelected(null);
        }}
      >
        <DialogContent
          className="border-border rounded border sm:max-w-[440px]"
          showCloseButton={!pending}
        >
          <DialogHeader>
            <DialogTitle>Delete {selected?.invoice.number}?</DialogTitle>
            <DialogDescription>
              This permanently removes the invoice, restores its items to stock, and reverses its
              payment-method entry.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p role="alert" className="text-destructive text-sm">
              {deleteError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setSelected(null)}
              className="border-border focus-visible:outline-primary rounded border px-4 py-2 text-sm focus-visible:outline-2 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground focus-visible:outline-primary rounded px-4 py-2 text-sm focus-visible:outline-2 disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Delete invoice"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
