import JsBarcode from "jsbarcode";

/** Encode without a DOM, so the preview and printed receipt use identical bars. */
export function receiptBarcodeBars(value: string): string {
  const output: { encodings?: { data: string }[] } = {};
  try {
    JsBarcode(output, value, { format: "CODE128", displayValue: false });
    const bits = output.encodings?.map((encoding) => encoding.data).join("") ?? "";
    return /^[01]+$/.test(bits) ? bits : "";
  } catch {
    // Retain readable barcode text for unsupported values in imported histories.
    return "";
  }
}
