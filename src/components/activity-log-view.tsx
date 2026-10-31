import Link from "next/link";
import { Activity } from "lucide-react";
import { PageHeader } from "./page-header";
import { DataTable } from "./data-table";
import { StatusBadge } from "./status-badge";
import { RefreshButton } from "./refresh-button";
import {
  activityLabel,
  type ActivityFilters,
  type queryActivityLog,
  type activityMetrics,
} from "@/lib/activity-log";
import { formatMoneyPrecise } from "@/lib/format";
type Props = {
  result: Awaited<ReturnType<typeof queryActivityLog>>;
  metrics: Awaited<ReturnType<typeof activityMetrics>>;
  filters: ActivityFilters;
  base: string;
  workspace: string;
  locations?: { id: string; name: string }[];
  location?: string;
};
export function ActivityLogView({
  result,
  metrics,
  filters,
  base,
  workspace,
  locations,
  location = "",
}: Props) {
  function href(change: Record<string, string>) {
    return `${base}?${new URLSearchParams({ q: filters.q, action: filters.action, range: filters.range ?? "30", ...(location ? { location } : {}), ...change })}`;
  }
  const cards = [
    ["Total events", metrics.events.toLocaleString("en-PK"), "neutral"],
    ["Invoices", `${metrics.invoices} — ${formatMoneyPrecise(metrics.invoiceAmount)}`, "neutral"],
    ["Cash in", formatMoneyPrecise(metrics.cashIn), "success"],
    ["Cash out", formatMoneyPrecise(metrics.cashOut), "danger"],
    ["Deletions", String(metrics.deletions), "danger"],
  ];
  const names = new Map(locations?.map((item) => [item.id, item.name]));
  return (
    <main>
      <PageHeader
        title="Activity log"
        eyebrow={workspace}
        description="Application activity — memberships, invoices, payments, stock and team access."
        action={<RefreshButton />}
      />
      <div className="activity-metrics">
        {cards.map(([label, value, tone]) => (
          <section className="panel" key={label}>
            <p>{label}</p>
            <strong data-tone={tone}>{value}</strong>
          </section>
        ))}
      </div>
      <p className="text-muted-foreground mt-3 text-xs">
        Totals cover the filtered recorded events, including payment reversals. Transfers are
        excluded from cash totals. Historical events may lack an amount or payment method.
      </p>
      <nav className="activity-periods" aria-label="Activity date range">
        {[
          ["today", "Today"],
          ["7", "7 days"],
          ["30", "30 days"],
          ["90", "3 months"],
          ["all", "All time"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={href({ range: value, page: "1" })}
            aria-current={(filters.range ?? "30") === value ? "page" : undefined}
            className={`dashboard-action ${(filters.range ?? "30") === value ? "is-primary" : ""}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <form action={base} className="filter-toolbar">
        <input type="hidden" name="range" value={filters.range ?? "30"} />
        <label className="form-field min-w-0 flex-1">
          Search activity
          <input
            type="search"
            name="q"
            maxLength={120}
            defaultValue={filters.q}
            className="border-input rounded-lg border px-3 py-2"
            placeholder="Member, invoice number, user or action"
          />
        </label>
        <label className="form-field">
          Type
          <select
            name="action"
            defaultValue={filters.action}
            className="border-input rounded-lg border px-3 py-2"
          >
            <option value="">All types</option>
            {[...new Set([...result.actions, ...(filters.action ? [filters.action] : [])])].map(
              (action) => (
                <option key={action} value={action}>
                  {activityLabel(action)}
                </option>
              )
            )}
          </select>
        </label>
        {locations && (
          <label className="form-field">
            Branch
            <select
              name="location"
              defaultValue={location}
              className="border-input rounded-lg border px-3 py-2"
            >
              <option value="">All branches</option>
              {locations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button className="dashboard-action is-primary">Apply filters</button>
        <Link href={base} className="dashboard-action">
          Clear
        </Link>
      </form>
      <div className="activity-table">
        <DataTable
          columns={[
            "Date & time",
            "Type",
            "Description",
            "User",
            ...(locations ? ["Branch"] : []),
            "Amount",
            "Status / method",
          ]}
          rows={result.rows.map((row) => {
            const tone =
              row.money.direction === "out"
                ? "danger"
                : row.money.direction === "in"
                  ? "success"
                  : "neutral";
            return [
              <span key="time" className="whitespace-nowrap">
                {new Intl.DateTimeFormat("en-PK", {
                  dateStyle: "medium",
                  timeZone: "Asia/Karachi",
                }).format(row.createdAt)}
                <small className="text-muted-foreground mt-1 block">
                  {new Intl.DateTimeFormat("en-PK", {
                    timeStyle: "short",
                    timeZone: "Asia/Karachi",
                  }).format(row.createdAt)}
                </small>
              </span>,
              <StatusBadge key="type" tone={tone}>
                {activityLabel(row.action)}
              </StatusBadge>,
              <span key="description">
                <strong className="font-medium">{row.record}</strong>
                <small className="text-muted-foreground mt-1 block">{row.detail}</small>
              </span>,
              row.actor,
              ...(locations ? [names.get(row.tenantId ?? "") ?? "Unavailable branch"] : []),
              <span
                key="amount"
                className={`font-semibold whitespace-nowrap ${tone === "danger" ? "text-destructive" : tone === "success" ? "text-success" : ""}`}
              >
                {row.money.amount === null
                  ? "—"
                  : `${row.money.direction === "out" ? "− " : ""}${formatMoneyPrecise(row.money.amount)}`}
              </span>,
              row.method,
            ];
          })}
          empty="No matching activity for this branch and date range."
        />
      </div>
      {!result.rows.length && (
        <div className="text-muted-foreground mt-3 flex items-center gap-2 text-sm">
          <Activity aria-hidden="true" className="size-4" />
          New events appear as your team uses the software.
        </div>
      )}
      <nav
        aria-label="Activity pages"
        className="mt-4 flex items-center justify-between gap-3 text-sm"
      >
        {result.page > 1 ? (
          <Link className="dashboard-action" href={href({ page: String(result.page - 1) })}>
            Previous
          </Link>
        ) : (
          <span />
        )}
        <span>
          {result.total} events · Page {result.page} of {result.pageCount}
        </span>
        {result.page < result.pageCount ? (
          <Link className="dashboard-action" href={href({ page: String(result.page + 1) })}>
            Next
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
