"use client";

import { useMemo, useRef, useState } from "react";
import { whatsappWebUrl } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { invoiceDocument, type InvoiceReceipt } from "./invoice-receipt";

export function InvoiceDialog({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: InvoiceReceipt;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const document = useMemo(() => invoiceDocument(invoice), [invoice]);

  function printInvoice() {
    const target = frame.current?.contentWindow;
    if (!target || !ready) return;
    target.focus();
    target.print();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="border-border max-h-[90dvh] overflow-y-auto rounded border sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="break-all">
              {invoice.heading ?? "Invoice"} {invoice.number}
            </DialogTitle>
            <DialogDescription>
              80 mm thermal receipt. Select your thermal printer and 80 mm paper, with headers and
              footers off.
            </DialogDescription>
          </DialogHeader>
          <iframe
            ref={frame}
            title={`${invoice.heading ?? "Invoice"} ${invoice.number} preview`}
            srcDoc={document}
            onLoad={() => setReady(true)}
            className="border-border mx-auto h-[min(60vh,600px)] w-full max-w-[80mm] rounded border bg-white"
          />
          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="border-border hover:bg-secondary focus-visible:outline-primary rounded border px-4 py-2.5 text-sm focus-visible:outline-2"
            >
              Close
            </button>
            {invoice.whatsapp && whatsappWebUrl(invoice.whatsapp) && (
              <a
                href={whatsappWebUrl(invoice.whatsapp)!}
                target="_blank"
                rel="noopener noreferrer"
                className="dashboard-action whatsapp-action"
              >
                <WhatsAppIcon className="size-5" />
                WhatsApp
              </a>
            )}
            <button
              type="button"
              disabled={!ready}
              onClick={printInvoice}
              className="bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:outline-primary flex items-center justify-center gap-2 rounded px-4 py-2.5 text-sm font-medium focus-visible:outline-2 disabled:opacity-50"
            >
              <Printer className="size-4" aria-hidden="true" /> Print receipt
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
