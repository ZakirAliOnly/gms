import Image from "next/image";
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
  const fields = [
    ["Member ID", profile.barcode],
    ["Joined", formatDate(new Date(profile.joinedAt))],
    ["WhatsApp number", profile.phone],
    ["CNIC", profile.cnic ?? "—"],
    ["Email", profile.email ?? "—"],
    ["Package", membership?.packageName ?? "No membership"],
    ["Membership start", membership ? formatDate(new Date(membership.startDate)) : "—"],
    ["Next renewal", membership ? formatDate(new Date(membership.nextRenewalDate)) : "—"],
  ];
  const pageHref = (page: number) =>
    `/app/memberships/scanner?${new URLSearchParams({ q: query, page: String(page) })}`;
  return (
    <section className="mt-6" aria-label="Member scan result">
      <div className="scanner-summary">
        <section className="panel p-5">
          <p className="text-muted-foreground text-sm">Renewal status</p>
          <strong className="mt-2 block text-xl">{renewal.label}</strong>
          <p className="text-muted-foreground mt-2 text-sm">{renewal.detail}</p>
        </section>
        <section className="panel p-5">
          <p className="text-muted-foreground text-sm">Current renewal fee</p>
          <strong className="mt-2 block text-xl">
            {membership ? formatMoneyPrecise(membership.renewalFee) : "—"}
          </strong>
          <p className="text-muted-foreground mt-2 text-xs">
            Package and extras; not a confirmed unpaid balance.
          </p>
        </section>
        <section className="panel p-5">
          <p className="text-muted-foreground text-sm">Total membership payments</p>
          <strong className="mt-2 block text-xl">{formatMoneyPrecise(record.totalPaid)}</strong>
          <p className="text-muted-foreground mt-2 text-sm">
            {record.totalCount} recorded payments
          </p>
        </section>
      </div>
      <section className="panel mt-5 p-5">
        <div className="flex items-center gap-4">
          {profile.photoUrl && (
            <Image
              src={profile.photoUrl}
              unoptimized
              alt={profile.name}
              width={72}
              height={72}
              className="size-18 rounded-lg object-cover"
            />
          )}
          <div className="min-w-0">
            <h2 className="text-xl font-semibold break-words">{profile.name}</h2>
            <p className="text-muted-foreground text-sm">{profile.branchName}</p>
          </div>
        </div>
        <dl className="scanner-profile mt-5">
          {fields.map(([label, value]) => (
            <div key={label} className="border-border min-w-0 border-b py-3">
              <dt className="text-muted-foreground text-xs">{label}</dt>
              <dd className="mt-1 text-sm font-medium break-words">{value}</dd>
            </div>
          ))}
        </dl>
        {membership && membership.extras.length > 0 && (
          <p className="text-muted-foreground mt-4 text-sm">
            Extras:{" "}
            {membership.extras
              .map((extra) => `${extra.name} (${formatMoneyPrecise(extra.fee)})`)
              .join(", ")}
          </p>
        )}
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
