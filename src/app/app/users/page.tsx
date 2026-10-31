import { tenantDb } from "@/lib/tenant-db";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { MODULES } from "@/lib/module-access";
import { UserDialog } from "./user-dialog";
export const metadata = { title: "User Management" };
export default async function UsersPage() {
  const { db, tenantId } = await tenantDb("users");
  const users = await db.user.findMany({
    where: { tenantId, role: "TENANT" },
    orderBy: [{ isBranchManager: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      isBranchManager: true,
      moduleAccess: true,
      editableModules: true,
    },
  });
  return (
    <main>
      <PageHeader
        title="User management"
        description="Create branch staff, control View/Edit access, reset passwords, and disable accounts. Permission changes apply to existing sessions."
        action={<UserDialog />}
      />
      <DataTable
        columns={["Name", "Email", "Access", "Status", "Actions"]}
        rows={users.map((user) => [
          user.name,
          user.email,
          user.isBranchManager
            ? "Branch manager — full access"
            : MODULES.filter((item) => user.moduleAccess.includes(item.key))
                .map(
                  (item) =>
                    `${item.label}: ${user.editableModules.includes(item.key) ? "View & Edit" : "View"}`
                )
                .join(" · "),
          <StatusBadge key={user.id} tone={user.status === "ACTIVE" ? "success" : "neutral"}>
            {user.status === "ACTIVE" ? "Active" : "Disabled"}
          </StatusBadge>,
          user.isBranchManager ? (
            "Manager account is protected"
          ) : (
            <UserDialog key={user.id} user={user} />
          ),
        ])}
      />
    </main>
  );
}
