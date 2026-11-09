import { CalendarDays, Coins, CreditCard, UserCheck } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { ScannerProfileCard } from "./scanner-profile-card";
import Link from "@/components/workspace-link";
import { formatDate, formatMoneyPrecise } from "@/lib/format";
import {
  scannerRenewalStatus,
  SCANNER_PAYMENT_PAGE_SIZE,
  type ScannerRecord,
} from "@/lib/member-scanner";
import { ScannerPrintButton } from "./scanner-controls";

export function MemberScannerReport({ record, query }: { record: ScannerRecord; query: string }) {
  const { profile, payments } = record;
  const membership = profile.membership;
  const renewal = scannerRenewalStatus(profile);
  const tone = renewal.pending
    ? "danger"
    : renewal.label === "Cancelled" || !membership
      ? "neutral"
      : renewal.label === "Upcoming renewal"
        ? "warning"
        : "success";
  const pageHref = (page: number) =>
    `/app/memberships/scanner?${new URLSearchParams({ q: query, page: String(page) })}`;
  return (
    <section className="scanner-result" aria-label="Member scan result">
      <div className="scanner-summary">
        <StatCard
          label="Renewal status"
          value={renewal.label}
          hint={renewal.detail}
          icon={UserCheck}
          tone={tone === "danger" ? "danger" : tone === "success" ? "success" : "primary"}
        />
        <StatCard
          label="Current renewal fee"
          value={membership ? formatMoneyPrecise(membership.renewalFee) : "—"}
          hint="Package and extras; not a confirmed unpaid balance."
          icon={Coins}
        />
        <StatCard
          label="Total membership payments"
          value={formatMoneyPrecise(record.totalPaid)}
          hint={`${record.totalCount} recorded payment${record.totalCount === 1 ? "" : "s"}.`}
          icon={CreditCard}
          tone="info"
        />
      </div>
      <ScannerProfileCard profile={profile} status={renewal.label} tone={tone} />
      <section className="scanner-renewal-notice" data-tone={tone} aria-label="Renewal schedule">
        <CalendarDays aria-hidden="true" />
        <h2>
          {renewal.pending
            ? "Renewal pending"
            : renewal.label === "Upcoming renewal"
              ? "Renewal due soon"
              : "Renewal schedule"}
        </h2>
        <p>
          {renewal.detail}
          {membership && membership.status !== "CANCELLED" && (
            <>
              {" "}
              Next renewal: <strong>{formatDate(new Date(membership.nextRenewalDate))}</strong>.
            </>
          )}
        </p>
      </section>
      <section className="panel mt-5 overflow-hidden">
        <header className="border-border border-b p-5">
          <h2 className="text-lg font-semibold">Membership payment history</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Admissions and renewals, newest first.
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr>
                {["Date", "Receipt", "Type", "Period", "Method", "Amount"].map((label) => (
                  <th key={label} className="px-4 py-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-4 py-3">{formatDate(new Date(payment.date))}</td>
                  <td className="px-4 py-3">{payment.number ?? "Not issued"}</td>
                  <td className="px-4 py-3">
                    {payment.kind === "ADMISSION" ? "Admission" : "Renewal"}
                  </td>
                  <td className="px-4 py-3">
                    {formatDate(new Date(payment.periodStart))} –{" "}
                    {formatDate(new Date(payment.periodEnd))}
                  </td>
                  <td className="px-4 py-3">{payment.method}</td>
                  <td className="px-4 py-3 font-medium">{formatMoneyPrecise(payment.amount)}</td>
                </tr>
              ))}
              {!payments.length && (
                <tr>
                  <td colSpan={6} className="text-muted-foreground p-5">
                    No payments recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="border-border flex flex-wrap items-center justify-between gap-3 border-t p-4">
          <p className="text-muted-foreground text-sm">
            {record.totalCount ? (record.page - 1) * SCANNER_PAYMENT_PAGE_SIZE + 1 : 0}–
            {Math.min(record.page * SCANNER_PAYMENT_PAGE_SIZE, record.totalCount)} of{" "}
            {record.totalCount}
          </p>
          <div className="flex gap-2">
            {record.page > 1 && (
              <Link href={pageHref(record.page - 1)} className="dashboard-action">
                Previous
              </Link>
            )}
            {record.page < record.pageCount && (
              <Link href={pageHref(record.page + 1)} className="dashboard-action">
                Next
              </Link>
            )}
          </div>
        </footer>
      </section>
      <ScannerPrintButton memberId={profile.id} />
    </section>
  );
}
