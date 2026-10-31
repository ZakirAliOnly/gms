"use client";

import { useCallback, useRef } from "react";
import { SOFTWARE_FOOTER } from "@/lib/branding";
import JsBarcode from "jsbarcode";
import { jsPDF } from "jspdf";
import { Download, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function printText(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!
  );
}

export type BarcodeTarget = {
  /** Headline on the label - a member's name, or a product's. */
  title: string;
  /** The value encoded in the bars. */
  barcode: string;
  /** Optional second line: package name, price, category. */
  subtitle?: string;
};

/**
 * Renders a Code128 barcode and prints it as a label.
 *
 * Used for both membership cards (FR-20) and product shelf labels.
 *
 * Code128 encodes the full alphanumeric code (IR100001) without a checksum
 * scheme to work around, which suits an internally generated id.
 *
 * Printing uses a hidden iframe rather than window.print(): printing the page
 * itself would carry the whole app - nav, table, footer - onto the label.
 */
export function BarcodeDialog({
  target,
  open,
  onOpenChange,
  heading = "Barcode",
  description,
}: {
  target: BarcodeTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dialog heading, distinct from the label's own title line. */
  heading?: string;
  description?: string;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  /**
   * Draws on the callback ref rather than in an effect.
   *
   * Radix mounts dialog content in a portal after render, so an effect keyed on
   * `open` fires while the SVG is still unmounted and JsBarcode silently draws
   * nothing. A callback ref runs at the moment the node actually attaches.
   */
  const drawInto = useCallback(
    (node: SVGSVGElement | null) => {
      svgRef.current = node;
      if (!node || !target) return;

      try {
        JsBarcode(node, target.barcode, {
          format: "CODE128",
          displayValue: true,
          fontSize: 16,
          font: "monospace",
          textMargin: 6,
          height: 70,
          width: 2,
          margin: 8,
          lineColor: "#000000",
          background: "#ffffff",
        });
      } catch (error) {
        // Surface it rather than shipping a blank label.
        console.error("Barcode render failed", error);
      }
    },
    [target]
  );

  /**
   * Renders the label onto a small PDF page and downloads it.
   *
   * The SVG is rasterised through a canvas first: jsPDF has no SVG support
   * without an extra plugin, and a PNG keeps the bars crisp at label size.
   */
  async function downloadPdf() {
    if (!target || !svgRef.current) return;

    const svgMarkup = new XMLSerializer().serializeToString(svgRef.current);
    const svgUrl = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgMarkup)));

    const scale = 4; // oversample so print output stays sharp
    const img = new Image();
    const png: string = await new Promise((resolve, reject) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Barcode image failed to load"));
      img.src = svgUrl;
    });

    // A compact label page: 80mm wide, height driven by the barcode aspect.
    const pageW = 80;
    const imgW = 60;
    const imgH = (img.height / img.width) * imgW;
    const textBlock = target.subtitle ? 16 : 10;
    const pageH = textBlock + imgH + 20;

    const pdf = new jsPDF({ unit: "mm", format: [pageW, pageH], orientation: "portrait" });
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(target.title, pageW / 2, 8, { align: "center" });
    if (target.subtitle) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(90);
      pdf.text(target.subtitle, pageW / 2, 13, { align: "center" });
      pdf.setTextColor(0);
    }
    pdf.addImage(png, "PNG", (pageW - imgW) / 2, textBlock, imgW, imgH);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text(SOFTWARE_FOOTER, pageW / 2, pageH - 5, { align: "center" });
    pdf.save(`${target.barcode}.pdf`);
  }

  function print() {
    if (!target || !svgRef.current) return;

    const svg = svgRef.current.outerHTML;
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);

    const doc = frame.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(frame);
      return;
    }

    doc.open();
    doc.write(`<!doctype html><html><head><title>${printText(target.barcode)}</title>
<style>
  @page { margin: 8mm; }
  body { margin: 0; font-family: system-ui, sans-serif; text-align: center; }
  .label { padding: 8px 4px; }
  .name { font-size: 13px; font-weight: 600; margin: 0 0 2px; }
  .meta { font-size: 11px; color: #444; margin: 0 0 8px; }
  svg { max-width: 100%; }
</style></head>
<body><div class="label">
  <p class="name">${printText(target.title)}</p>
  ${target.subtitle ? `<p class="meta">${printText(target.subtitle)}</p>` : ""}
  ${svg}
<p style="font-size:10px;margin-top:10px">${SOFTWARE_FOOTER}</p></div></body></html>`);
    doc.close();

    const win = frame.contentWindow!;
    const cleanup = () => {
      // Give the print dialog time to take the document before removing it.
      setTimeout(() => frame.remove(), 1000);
    };

    win.addEventListener("afterprint", cleanup, { once: true });
    win.focus();
    win.print();
    // Fallback for browsers that never fire afterprint.
    setTimeout(cleanup, 8000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>
            {description ?? "Scan this code to look the record up."}
          </DialogDescription>
        </DialogHeader>

        {target && (
          <div className="border-border flex flex-col items-center gap-2 rounded-lg border bg-white px-4 py-5">
            <p className="text-sm font-semibold text-[#1c1b1b]">{target.title}</p>
            {target.subtitle && <p className="text-[12px] text-[#5d5f5f]">{target.subtitle}</p>}
            <svg ref={drawInto} role="img" aria-label={`Barcode ${target.barcode}`} />
          </div>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="border-border text-muted-foreground hover:border-primary hover:text-primary rounded border px-4 py-2.5 text-sm transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            className="border-border text-muted-foreground hover:border-primary hover:text-primary flex items-center gap-2 rounded border px-4 py-2.5 text-sm transition-colors"
          >
            <Download className="size-4" aria-hidden="true" />
            Download PDF
          </button>
          <button
            type="button"
            onClick={print}
            className="bg-primary text-primary-foreground hover:bg-primary-hover flex items-center gap-2 rounded px-4 py-2.5 text-sm font-medium transition-colors"
          >
            <Printer className="size-4" aria-hidden="true" />
            Print barcode
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
