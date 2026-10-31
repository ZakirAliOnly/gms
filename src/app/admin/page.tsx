import Link from "next/link";
import { requireRole } from "@/lib/guards";
import { db } from "@/lib/db";
import { PlatformShell } from "@/components/platform-shell";
import { getAdminDashboardStats } from "@/app/app/dashboard-data";
import { DashboardView } from "@/components/dashboard-view";
import { AdminBranchAction } from "@/components/admin-branch-action";

export default async function AdminPage() {
  const user = await requireRole("ADMIN");
  const [branches, stats] = await Promise.all([
    db.tenant.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        location: true,
        status: true,
        _count: { select: { members: true } },
      },
    }),
    getAdminDashboardStats(),
  ]);
  return (
    <PlatformShell
      role="Admin"
      userName={user.name ?? undefined}
      userEmail={user.email ?? ""}
      home="/admin"
    >
      <DashboardView
        admin
        userName={user.name ?? undefined}
        tenantName="All branches"
        tenantLocation="Admin"
        stats={stats}
        quickActions={
          <>
            <AdminBranchAction
              branches={branches}
              module="memberships?action=add"
              label="Add membership"
              secondary
            />
            <AdminBranchAction branches={branches} module="invoices" label="New sale" secondary />
            <AdminBranchAction
              branches={branches}
              module="expenses?action=add"
              label="Record expense"
              secondary
            />
            <AdminBranchAction
              branches={branches}
              module="memberships?scan=1"
              label="Scan barcode"
              secondary
            />
          </>
        }
      >
        <section className="mt-6" aria-labelledby="branches-heading">
          <h2 id="branches-heading" className="label-caps text-muted-foreground">
            Branches
          </h2>
          <div className="border-border bg-card mt-3 overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-[13px]">
              <thead className="border-border bg-secondary border-b">
                <tr>
                  {["Branch", "Location", "Members", "Status", ""].map((label) => (
                    <th
                      key={label}
                      className="label-caps text-muted-foreground px-4 py-3 font-medium whitespace-nowrap"
                    >
                      {label || <span className="sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => (
                  <tr
                    key={branch.id}
                    className="border-border hover:bg-secondary/40 border-b last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">{branch.name}</td>
                    <td className="text-muted-foreground px-4 py-3">{branch.location}</td>
                    <td className="data-mono px-4 py-3">{branch._count.members}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          branch.status === "ACTIVE"
                            ? "bg-primary/5 text-primary rounded-sm px-2 py-1"
                            : "bg-secondary text-muted-foreground rounded-sm px-2 py-1"
                        }
                      >
                        {branch.status === "ACTIVE" ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {branch.status === "ACTIVE" && (
                        <Link
                          href={"/admin/branches/" + branch.id}
                          className="border-border text-primary hover:border-primary hover:bg-primary/5 rounded border px-3 py-2 whitespace-nowrap transition-colors"
                        >
                          Open branch
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!branches.length && (
              <p className="text-muted-foreground px-6 py-16 text-center text-sm">
                No branches have been created yet.
              </p>
            )}
          </div>
        </section>
      </DashboardView>
    </PlatformShell>
  );
}
