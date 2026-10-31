"use client";

import { useWorkspaceBase } from "@/components/workspace-link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";

/**
 * Search by name, phone, or barcode (FR-21).
 * Debounced and written to the URL, so a result list is shareable and
 * survives a reload.
 */
export function SearchBox({ tab, scan = false }: { tab: string; scan?: boolean }) {
  const router = useRouter();
  const base = useWorkspaceBase();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [, startTransition] = useTransition();

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (value === current) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set("q", value);
      else next.delete("q");
      next.delete("page");
      next.set("tab", tab);
      startTransition(() => router.replace(`${base}/memberships?${next}`, { scroll: false }));
    }, 300);

    return () => clearTimeout(timer);
  }, [value, params, router, tab, base]);

  return (
    <div className="relative w-full sm:w-80">
      <Search
        className="text-muted-foreground/60 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <input
        key={scan ? "scan" : "search"}
        autoFocus={scan}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={
          scan ? "Scan a barcode or type a member number…" : "Search name, phone, or barcode…"
        }
        aria-label="Search members"
        className="border-input bg-card placeholder:text-muted-foreground/60 focus:border-primary focus:ring-primary w-full rounded border py-2 pr-3 pl-9 text-sm transition-colors outline-none focus:ring-1"
      />
    </div>
  );
}
