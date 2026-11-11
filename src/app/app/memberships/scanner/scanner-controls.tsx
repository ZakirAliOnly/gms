"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Barcode, Printer, ScanLine } from "lucide-react";
import { useWorkspaceBase } from "@/components/workspace-link";
import { getScannerPrintDocument } from "./actions";

export function ScannerSearch({ query }: { query: string }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const base = useWorkspaceBase();
  const [pending, start] = useTransition();
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, [query]);
  return (
    <form
      className="panel scanner-search"
      onSubmit={(event) => {
        event.preventDefault();
        window.dispatchEvent(new Event("scanner-lookup-start"));
        const value = input.current?.value.trim() ?? "";
        start(() => {
          router.replace(
            `${base}/memberships/scanner?${new URLSearchParams({ q: value, scan: crypto.randomUUID() })}`,
            { scroll: false }
          );
        });
        input.current?.select();
      }}
    >
      <label className="grid min-w-0 flex-1 gap-2 text-sm font-medium" htmlFor="scanner-code">
        Scan barcode or enter Member ID
      </label>
      <div className="scanner-search-row">
        <div className="scanner-search-input">
          <Barcode aria-hidden="true" />
          <input
            ref={input}
            key={query}
            id="scanner-code"
            name="q"
            type="search"
            defaultValue={query}
            autoFocus
            autoComplete="off"
            maxLength={128}
            placeholder="Scan or type IR123456, then press Enter"
            className="border-input bg-card min-w-0 flex-1 rounded-lg border px-4 py-3"
          />
        </div>
        <button disabled={pending} className="dashboard-action is-primary disabled:opacity-50">
          <ScanLine className="size-5" />
          {pending ? "Searching…" : "Find member"}
        </button>
      </div>
    </form>
  );
}

export function ScannerPrintButton({
  memberId,
  compact = false,
}: {
  memberId: string;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className={compact ? "scanner-print-action" : "mt-6 flex flex-col items-end gap-2"}>
      <button
        type="button"
        disabled={pending}
        className="dashboard-action is-primary disabled:opacity-50"
        onClick={() =>
          start(async () => {
            setError("");
            try {
              const result = await getScannerPrintDocument(memberId);
              if (!result.html) {
                setError(result.error ?? "Report could not load.");
                return;
              }
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
                win.addEventListener(
                  "afterprint",
                  () =>
                    setTimeout(() => {
                      frame.remove();
                      const search = document.getElementById(
                        "scanner-code"
                      ) as HTMLInputElement | null;
                      search?.focus();
                      search?.select();
                    }, 1000),
                  {
                    once: true,
                  }
                );
                win.focus();
                win.print();
                setTimeout(() => frame.remove(), 120000);
              };
              frame.srcdoc = result.html;
              document.body.appendChild(frame);
            } catch {
              setError("Report could not load. Please try again.");
            }
          })
        }
      >
        <Printer className="size-5" />
        {pending ? "Preparing report…" : compact ? "Print Profile" : "Print member report"}
      </button>
      {!compact && (
        <p className="text-muted-foreground text-xs">
          Prints an A4 report with the complete payment history, including all pages.
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
