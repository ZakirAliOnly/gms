import { getTenantContext } from "@/lib/tenant-context";
import { getDashboardStats } from "./dashboard-data";
import { DashboardView } from "@/components/dashboard-view";
export const metadata = { title: "Dashboard" };
export default async function TenantDashboardPage() {
  const { tenantName, tenantLocation, userName } = await getTenantContext();
  const stats = await getDashboardStats();
  return (
    <DashboardView
      userName={userName}
      tenantName={tenantName}
      tenantLocation={tenantLocation}
      stats={stats}
    />
  );
}
