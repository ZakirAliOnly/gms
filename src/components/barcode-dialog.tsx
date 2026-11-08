"use client";

import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { Download, Printer } from "lucide-react";
import {
  barcodeLabelSvg,
  barcodeLabelDocument,
  BARCODE_LABEL_MM,
  type BarcodeTarget,
} from "@/lib/barcode-label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
export type { BarcodeTarget } from "@/lib/barcode-label";

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
  heading?: string;
  description?: string;
}) {
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const label = useMemo(() => {
    try {
      return { svg: target ? barcodeLabelSvg(target) : "", error: "" };
    } catch (error) {
      return { svg: "", error: error instanceof Error ? error.message : "Barcode could not load." };
    }
  }, [target]);

  async function downloadPdf() {
    if (!target || !label.svg) return;
    setDownloading(true);
    setError("");
    try {
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(label.svg)}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 600; // 600 dpi at exactly 2 x 1 inches.
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Label image could not be prepared.");
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      const pdf = new jsPDF({
        unit: "mm",
        format: [BARCODE_LABEL_MM.width, BARCODE_LABEL_MM.height],
        orientation: "landscape",
        compress: true,
      });
      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        0,
        0,
        BARCODE_LABEL_MM.width,
        BARCODE_LABEL_MM.height
      );
      pdf.save(`${target.barcode.replace(/[^\w-]/g, "_")}.pdf`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Label download failed.");
    } finally {
      setDownloading(false);
    }
  }

  function print() {
    if (!target || !label.svg) return;
    setError("");
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText =
      "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0;bottom:0;right:0";
    frame.onload = async () => {
      const win = frame.contentWindow;
      if (!win) {
        frame.remove();
        setError("Print preview could not open.");
        return;
      }
      await win.document.fonts.ready;
      win.addEventListener("afterprint", () => setTimeout(() => frame.remove(), 1000), {
        once: true,
      });
      win.focus();
      win.print();
      setTimeout(() => frame.remove(), 120000);
    };
    frame.srcdoc = barcodeLabelDocument(target);
    document.body.appendChild(frame);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>
            {description ?? "Scan this Member ID to find the member."}
          </DialogDescription>
        </DialogHeader>
        {label.svg && (
          <div
            className="barcode-label-preview border-border rounded-lg border p-4"
            dangerouslySetInnerHTML={{ __html: label.svg }}
          />
        )}
        <p className="text-muted-foreground text-sm">
          2 × 1 inch label (50.8 × 25.4 mm). Choose matching label stock, 100% / Actual size, and no
          print margins.
        </p>
        {target?.subtitle && <p className="text-muted-foreground text-xs">{target.subtitle}</p>}
        {(label.error || error) && (
          <p role="alert" className="text-destructive text-sm">
            {label.error || error}
          </p>
        )}
        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} className="dashboard-action">
            Close
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={!label.svg || downloading}
            className="dashboard-action disabled:opacity-50"
          >
            <Download className="size-4" />
            {downloading ? "Preparing…" : "Download PDF"}
          </button>
          <button
            type="button"
            onClick={print}
            disabled={!label.svg}
            className="dashboard-action is-primary disabled:opacity-50"
          >
            <Printer className="size-4" />
            Print barcode
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
