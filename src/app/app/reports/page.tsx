import Link from "@/components/workspace-link";
import { tenantDb } from "@/lib/tenant-db";
import { getTenantContext } from "@/lib/tenant-context";
import { PageHeader } from "@/components/page-header";
import { buildReports } from "@/lib/reports";
import { reportRange } from "@/lib/report-range";
import { DataTable } from "@/components/data-table";
import { PrintReportButton } from "./print-button";

export const metadata = { title: "Reports" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { db, tenantId } = await tenantDb();
  const { tenantName, adminBranch } = await getTenantContext();
  const sp = await searchParams;
  let range;
  try {
    range = reportRange(sp.from, sp.to);
  } catch (error) {
    return (
      <main className="mx-auto max-w-[1440px] px-4 py-8">
        <PageHeader eyebrow="Analysis" title="Reports" />
        <p role="alert" className="mt-4">
          {(error as Error).message}
        </p>
        <Link href="/app/reports" className="text-primary underline">
          Reset date range
        </Link>
      </main>
    );
  }
  const sections = await buildReports(db, tenantId, range);
  const query = new URLSearchParams({ from: range.from, to: range.to });
  const base = adminBranch ? `/admin/branches/${tenantId}` : "/app";
  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8">
      <PageHeader
        eyebrow={tenantName}
        title="Reports"
        description={`${range.from} to ${range.to} · Asia/Karachi · PKR`}
      />
      <form className="mt-4 flex flex-wrap items-end gap-3 print:hidden">
        <label className="flex flex-col gap-1 text-sm">
          From
          <input
            type="date"
            name="from"
            defaultValue={range.from}
            required
            className="border-input rounded border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          To
          <input
            type="date"
            name="to"
            defaultValue={range.to}
            required
            className="border-input rounded border px-3 py-2"
          />
        </label>
        <button className="bg-primary text-primary-foreground rounded px-3 py-2 text-sm">
          Apply dates
        </button>
        <a
          href={`${base}/reports/export?${query}`}
          className="border-border rounded border px-3 py-2 text-sm"
        >
          Export CSV
        </a>
        <PrintReportButton />
      </form>
      {sections.map((section) => (
        <section key={section.title} className="mt-8">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          {section.note && <p className="text-muted-foreground mt-1 text-sm">{section.note}</p>}
          <DataTable
            columns={section.columns}
            rows={section.rows.map((row) =>
              row.map((value) =>
                typeof value === "number"
                  ? value.toLocaleString("en-PK", { maximumFractionDigits: 2 })
                  : value
              )
            )}
            empty="No records for this period."
          />
        </section>
      ))}
    </main>
  );
}
