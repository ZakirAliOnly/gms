import type { MembershipRow } from "./data";
import { StatusBadge } from "@/components/status-badge";

/**
 * Derives the label from the due date rather than the stored status, so a
 * membership reads as overdue the moment it falls due.
 */
export function statusOf(row: Pick<MembershipRow, "status" | "daysUntilDue">) {
  if (row.status === "CANCELLED") return { label: "Cancelled", tone: "muted" as const };
  if (row.daysUntilDue < 0) {
    const days = Math.abs(row.daysUntilDue);
    return { label: `Overdue ${days}d`, tone: "danger" as const };
  }
  if (row.daysUntilDue === 0) return { label: "Due today", tone: "danger" as const };
  if (row.daysUntilDue <= 7) return { label: "Due soon", tone: "warning" as const };
  return { label: "Active", tone: "ok" as const };
}

export function StatusPill({ row }: { row: Pick<MembershipRow, "status" | "daysUntilDue"> }) {
  const { label, tone } = statusOf(row);
  return (
    <StatusBadge tone={tone === "ok" ? "success" : tone === "muted" ? "neutral" : tone}>
      {label}
    </StatusBadge>
  );
}
