import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { PageHeader } from "@/components/page-header";
import { PlatformShell } from "@/components/platform-shell";
export const metadata = { title: "Workers" };
export default async function SupervisorWorkersPage() {
  const user = await requireRole("ADMIN");
  const branches = await db.tenant.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, location: true },
    orderBy: { name: "asc" },
  });
  return (
    <PlatformShell role="Admin" home="/admin" userName={user.name} userEmail={user.email}>
      <main>
        <PageHeader
          title="Workers"
          description="Choose a branch to view workers, wages and payments."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {branches.map((branch) => (
            <Link
              key={branch.id}
              href={`/admin/branches/${branch.id}/workers`}
              className="panel p-5"
            >
              <strong>{branch.name}</strong>
              <p className="text-muted-foreground mt-1 text-sm">{branch.location}</p>
            </Link>
          ))}
        </div>
        {!branches.length && <p className="text-muted-foreground mt-5">No active branches.</p>}
      </main>
    </PlatformShell>
  );
}
