import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { PlatformShell } from "@/components/platform-shell";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
export const metadata = { title: "User Management" };
export default async function SupervisorUsersPage() {
  const user = await requireRole("ADMIN");
  const branches = await db.tenant.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, location: true },
  });
  return (
    <PlatformShell role="Admin" home="/admin" userName={user.name} userEmail={user.email}>
      <main>
        <PageHeader
          title="User management"
          description="Supervisor access: select any branch to manage its staff and permissions."
        />
        <DataTable
          columns={["Branch", "Location", "Users"]}
          rows={branches.map((branch) => [
            branch.name,
            branch.location,
            <Link
              key={branch.id}
              className="dashboard-action"
              href={`/admin/branches/${branch.id}/users`}
            >
              Manage users
            </Link>,
          ])}
        />
      </main>
    </PlatformShell>
  );
}
