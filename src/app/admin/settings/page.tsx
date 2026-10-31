import { requireRole } from "@/lib/guards";
import { PlatformShell } from "@/components/platform-shell";
import { SettingsView } from "@/components/settings-view";
export const metadata = { title: "Settings" };
export default async function AdminSettingsPage() {
  const user = await requireRole("ADMIN");
  return (
    <PlatformShell
      role="Admin"
      home="/admin"
      userName={user.name ?? undefined}
      userEmail={user.email ?? ""}
    >
      <SettingsView
        name={user.name ?? "Admin"}
        email={user.email ?? ""}
        role="Admin"
        workspace="All branches"
      />
    </PlatformShell>
  );
}
