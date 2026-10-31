import { requireRole } from "@/lib/guards";
import { PlatformShell } from "@/components/platform-shell";
import { SettingsView } from "@/components/settings-view";
export const metadata = { title: "Settings" };
export default async function PlatformSettingsPage() {
  const user = await requireRole("SUPERADMIN");
  return (
    <PlatformShell
      role="Superadmin"
      home="/superadmin"
      userName={user.name ?? undefined}
      userEmail={user.email ?? ""}
    >
      <SettingsView
        name={user.name ?? "Superadmin"}
        email={user.email ?? ""}
        role="Superadmin"
        workspace="Platform management"
      />
    </PlatformShell>
  );
}
