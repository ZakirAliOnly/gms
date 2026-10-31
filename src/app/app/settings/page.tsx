import { getTenantContext } from "@/lib/tenant-context";
import { SettingsView } from "@/components/settings-view";
export const metadata = { title: "Settings" };
export default async function SettingsPage() {
  const context = await getTenantContext();
  return (
    <SettingsView
      name={context.userName}
      email={context.userEmail}
      role={
        context.adminBranch ? "Supervisor" : context.isBranchManager ? "Branch manager" : "Staff"
      }
      workspace={context.tenantName}
      location={context.tenantLocation}
    />
  );
}
