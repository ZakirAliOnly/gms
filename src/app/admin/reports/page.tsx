import Link from "next/link";
import { requireRole } from "@/lib/guards";
import { db } from "@/lib/db";
import { PlatformShell } from "@/components/platform-shell";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { FeedbackState } from "@/components/feedback-state";

export const metadata = { title: "Reports" };
export default async function AdminReportsPage() {
  const user = await requireRole("ADMIN");
  const branches = await db.tenant.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, location: true, status: true },
  });
  return (
    <PlatformShell
      role="Admin"
      home="/admin"
      userName={user.name ?? undefined}
      userEmail={user.email ?? ""}
    >
      <main>
        <PageHeader
          title="Reports"
          description="Choose a branch to inspect memberships, sales, FIFO inventory, suppliers, expenses, and cash movement."
        />
        {branches.length ? (
          <DataTable
            columns={["Branch", "Location", "Status", "Reports"]}
            rows={branches.map((branch) => [
              branch.name,
              branch.location,
              <StatusBadge
                key={branch.id}
                tone={branch.status === "ACTIVE" ? "success" : "neutral"}
              >
                {branch.status === "ACTIVE" ? "Active" : "Suspended"}
              </StatusBadge>,
              branch.status === "ACTIVE" ? (
                <Link
                  key={branch.id}
                  href={`/admin/branches/${branch.id}/reports`}
                  className="dashboard-action"
                >
                  Open reports
                </Link>
              ) : (
                "Branch suspended"
              ),
            ])}
          />
        ) : (
          <div className="mt-6">
            <FeedbackState
              title="No branches yet"
              description="Branch reports will appear when a branch is created."
            />
          </div>
        )}
      </main>
    </PlatformShell>
  );
}
