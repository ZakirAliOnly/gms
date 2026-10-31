"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="dashboard-action"
      disabled={pending}
      onClick={() => start(() => router.refresh())}
    >
      <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} aria-hidden="true" />
      {pending ? "Refreshing…" : "Refresh"}
    </button>
  );
}
