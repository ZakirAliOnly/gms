"use client";
export function PrintReportButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="border-border rounded border px-3 py-2 text-sm print:hidden"
    >
      Print / Save PDF
    </button>
  );
}
