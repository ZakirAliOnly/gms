import { tenantDb } from "@/lib/tenant-db";
import { getTenantContext } from "@/lib/tenant-context";
import { getActivityLog, parseActivityFilters, activityMetrics } from "@/lib/activity-log";
import { ActivityLogView } from "@/components/activity-log-view";
export const metadata = { title: "Activity Log" };
export default async function BranchActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { db, tenantId } = await tenantDb("activity-log");
  const context = await getTenantContext();
  const filters = parseActivityFilters(await searchParams);
  const [result, metrics] = await Promise.all([
    getActivityLog(db, tenantId, filters),
    activityMetrics(db, { tenantId }, filters),
  ]);
  const base = context.adminBranch
    ? `/admin/branches/${tenantId}/activity-log`
    : "/app/activity-log";
  return (
    <ActivityLogView
      result={result}
      metrics={metrics}
      filters={filters}
      base={base}
      workspace={context.tenantName}
    />
  );
}
