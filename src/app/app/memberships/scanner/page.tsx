import { ScanLine } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { tenantDb } from "@/lib/tenant-db";
import { memberScannerRecord } from "@/lib/member-scanner";
import { ScannerSession } from "./scanner-session";
import { ScannerSearch } from "./scanner-controls";
import { MemberScannerReport } from "./member-scanner-report";
export const metadata = { title: "Barcode Scanner" };

export default async function MemberScannerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { db, tenantId } = await tenantDb("memberships");
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim().slice(0, 128) ?? "";
  const scanKey = (Array.isArray(params.scan) ? params.scan[0] : params.scan) ?? "";
  const record = query
    ? await memberScannerRecord(db, tenantId, { barcode: query }, 1, false, true)
    : null;
  return (
    <main className="scanner-page">
      <ScannerSession query={query} scanKey={scanKey}>
        <div className="scanner-page-heading">
          <span className="scanner-title-icon">
            <ScanLine aria-hidden="true" />
          </span>
          <PageHeader
            title="Profile Scanner"
            description="Scan a member barcode or enter Member ID to view their profile and renewal status."
          />
        </div>
        <ScannerSearch query={query} />
        {record ? (
          <MemberScannerReport record={record} />
        ) : (
          <section className="panel text-muted-foreground mt-6 p-6" role="status">
            {query
              ? "No member found in this branch for that Member ID."
              : "Ready to scan. Member profile and renewal status will appear here."}
          </section>
        )}
      </ScannerSession>
    </main>
  );
}
