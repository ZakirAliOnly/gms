import { PageHeader } from "@/components/page-header";
import { tenantDb } from "@/lib/tenant-db";
import { memberScannerRecord } from "@/lib/member-scanner";
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
  const page = Number(Array.isArray(params.page) ? params.page[0] : params.page) || 1;
  const record = query ? await memberScannerRecord(db, tenantId, { barcode: query }, page) : null;
  return (
    <main>
      <PageHeader
        title="Barcode Scanner"
        description="Read-only member lookup. Scan the barcode or enter the exact Member ID and press Enter."
      />
      <ScannerSearch query={query} />
      {record ? (
        <MemberScannerReport record={record} query={query} />
      ) : (
        <section className="panel text-muted-foreground mt-6 p-6" role="status">
          {query
            ? "No member found in this branch for that Member ID."
            : "Ready to scan. Member details and payment history will appear here."}
        </section>
      )}
    </main>
  );
}
