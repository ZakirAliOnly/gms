import { requireRole } from "@/lib/guards";
import { db } from "@/lib/db";
import { PlatformShell } from "@/components/platform-shell";
import { ActivityLogView } from "@/components/activity-log-view";
import { parseActivityFilters, queryActivityLog, activityMetrics } from "@/lib/activity-log";
export const metadata = { title: "Activity Log" };
export default async function SupervisorActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("ADMIN");
  const sp = await searchParams;
  const filters = parseActivityFilters(sp);
  const location = (Array.isArray(sp.location) ? sp.location[0] : sp.location)?.trim() ?? "";
  const scope = { admin: true as const, ...(location ? { tenantId: location } : {}) };
  const [result, metrics, locations] = await Promise.all([
    queryActivityLog(db, scope, filters),
    activityMetrics(db, scope, filters),
    db.tenant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <PlatformShell role="Admin" home="/admin" userName={user.name} userEmail={user.email}>
      <ActivityLogView
        result={result}
        metrics={metrics}
        filters={filters}
        base="/admin/activity-log"
        workspace="Supervisor · All branches"
        locations={locations}
        location={location}
      />
    </PlatformShell>
  );
}
