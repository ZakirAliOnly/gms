import { formatDate, formatMoneyPrecise } from "@/lib/format";
import { SOFTWARE_FOOTER } from "@/lib/branding";

export type InvoiceReceipt = {
  heading?: string;
  details?: { label: string; value: string }[];
  paymentOnly?: boolean;
  number: string;
  soldAt: string;
  businessName: string;
  location: string | null;
  customer: string;
  paymentMethod: string;
  subtotal: string;
  discount: string;
  total: string;
  lines: { name: string; quantity: number; unitPrice: string; total: string }[];
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]!
  );
}

/** One document for both the modal preview and the browser's print dialog. */
export function invoiceDocument(invoice: InvoiceReceipt): string {
  const text = escapeHtml;
  const money = (value: string) => text(formatMoneyPrecise(value));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${text(invoice.number)}</title>
<style>
  /* The printer driver supplies roll length; select 80 mm paper in Print. */
  @page { size: auto; margin: 0; }
  * { box-sizing: border-box; }
  body { width: 80mm; max-width: 100%; margin: 0 auto; padding: 4mm; background: white; color: black; font: 12px/1.4 Arial, sans-serif; }
  h1 { font-size: 18px; margin: 0; text-align: center; overflow-wrap: anywhere; }
  h2 { font-size: 13px; margin: 4mm 0 1mm; text-align: center; overflow-wrap: anywhere; }
  p { margin: 1mm 0; overflow-wrap: anywhere; }
  .muted { color: black; text-align: center; }
  table { width: 100%; border-collapse: collapse; margin-top: 4mm; table-layout: fixed; }
  th, td { padding: 2mm 0; border-bottom: 1px dashed black; text-align: right; vertical-align: top; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
  th:first-child, td:first-child { text-align: left; width: 60%; padding-right: 2mm; }
  th { font-size: 11px; border-top: 1px dashed black; }
  .quantity { display: block; margin-top: 1mm; font-size: 11px; }
  tr { break-inside: avoid; }
  thead { display: table-header-group; }
  dl { margin: 3mm 0 0; break-inside: avoid; }
  dl div { display: flex; justify-content: space-between; gap: 2mm; padding: 1mm 0; }
  dd { margin: 0; text-align: right; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
  .total { border-top: 1px dashed black; margin-top: 2mm; padding-top: 2mm; font-weight: bold; font-size: 14px; }
  footer { margin-top: 5mm; padding-top: 3mm; border-top: 1px dashed black; text-align: center; font-size: 10px; break-inside: avoid; }
  @media print { body { margin: 0; } }</style></head><body>
<h1>${text(invoice.businessName)}</h1>
${invoice.location ? `<p class="muted">${text(invoice.location)}</p>` : ""}
<h2>${text(invoice.heading ?? "Invoice")} ${text(invoice.number)}</h2>
<p class="muted">${text(formatDate(new Date(invoice.soldAt)))}</p>
<p><strong>Customer:</strong> ${text(invoice.customer)}</p>
<p><strong>Payment method:</strong> ${text(invoice.paymentMethod)}</p>
${(invoice.details ?? []).map((detail) => `<p><strong>${text(detail.label)}:</strong> ${text(detail.value)}</p>`).join("")}
<table aria-label="Invoice items"><thead><tr><th scope="col">Item</th><th scope="col">Amount</th></tr></thead><tbody>
${invoice.lines.map((line) => `<tr><td>${text(line.name)}<span class="quantity">${text(String(line.quantity))} × ${money(line.unitPrice)}</span></td><td>${money(line.total)}</td></tr>`).join("")}
</tbody></table>
<dl>${invoice.paymentOnly ? "" : `<div><dt>Subtotal</dt><dd>${money(invoice.subtotal)}</dd></div><div><dt>Discount</dt><dd>${money(invoice.discount)}</dd></div>`}<div class="total"><dt>Total paid</dt><dd>${money(invoice.total)}</dd></div></dl>
<footer>${text(SOFTWARE_FOOTER)}</footer></body></html>`;
}
