import { GYM_NAME, SOFTWARE_FOOTER } from "./branding";
import { receiptBarcodeBars } from "./receipt-barcode";

export type BarcodeTarget = { title: string; barcode: string; subtitle?: string };
export const BARCODE_LABEL_MM = { width: 50.8, height: 25.4 } as const;
export function printText(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!
  );
}

/** One 2 x 1 inch design for screen preview, print and high-resolution PDF. */
export function barcodeLabelSvg(target: BarcodeTarget): string {
  const bits = receiptBarcodeBars(target.barcode);
  if (!bits) throw new Error("This Member ID cannot be encoded as a barcode.");
  // A quiet zone of at least ten modules per side, with modules >= 0.25 mm.
  const moduleWidth = 468 / (bits.length + 20);
  if (moduleWidth < 2.5)
    throw new Error("This Member ID is too long for a readable 2 × 1 inch label.");
  const bars: string[] = [];
  for (let index = 0; index < bits.length;) {
    if (bits[index] === "0") {
      index++;
      continue;
    }
    const first = index;
    while (bits[index] === "1") index++;
    bars.push(
      `<rect x="${20 + (first + 10) * moduleWidth}" y="76" width="${(index - first) * moduleWidth}" height="90"/>`
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="50.8mm" height="25.4mm" viewBox="0 0 508 254" role="img" aria-label="Member barcode ${printText(target.barcode)}">
<rect width="508" height="254" fill="white"/>
<defs><clipPath id="member-label-name"><rect x="20" y="40" width="468" height="30"/></clipPath></defs>
<g fill="black" font-family="Arial, sans-serif" text-anchor="middle">
<text x="254" y="32" font-size="28" font-weight="700">${printText(GYM_NAME)}</text>
<text x="254" y="60" font-size="23" clip-path="url(#member-label-name)">${printText(target.title)}</text>
${bars.join("")}
<text x="254" y="204" font-family="monospace" font-size="29" font-weight="700">Member ID: ${printText(target.barcode)}</text>
<text x="254" y="239" font-size="14">${printText(SOFTWARE_FOOTER)}</text>
</g></svg>`;
}

export function barcodeLabelDocument(target: BarcodeTarget): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${printText(target.barcode)}</title><style>
@page { size: 2in 1in; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; width: 50.8mm; height: 25.4mm; background: white; }
svg { display: block; width: 50.8mm; height: 25.4mm; }
</style></head><body>${barcodeLabelSvg(target)}</body></html>`;
}
