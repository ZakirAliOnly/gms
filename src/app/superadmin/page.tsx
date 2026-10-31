import { Building2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { PlatformShell } from "@/components/platform-shell";
import { CreateTenantDialog } from "./create-tenant-dialog";

const dateFormat = new Intl.DateTimeFormat("en-PK", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Karachi",
});

export default async function SuperadminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = (await searchParams).q?.trim();
  const user = await requireRole("SUPERADMIN");

  const tenants = await db.tenant.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { location: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      location: true,
      status: true,
      createdAt: true,
      users: { select: { email: true }, take: 1 },
    },
  });

  return (
    <PlatformShell
      role="Superadmin"
      userName={user.name ?? undefined}
      userEmail={user.email ?? ""}
      home="/superadmin"
    >
      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8">
        <header className="border-border flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div>
            <p className="label-caps text-muted-foreground">Superadmin</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Tenants</h1>
          </div>
          <CreateTenantDialog />
        </header>

        {tenants.length === 0 ? (
          <div className="border-border bg-card mt-8 flex flex-col items-center justify-center rounded-lg border px-6 py-16 text-center">
            <Building2 className="text-muted-foreground/50 size-8" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium">No tenants yet</p>
            <p className="text-muted-foreground mt-1 text-[13px] leading-[18px]">
              Create one to provision its management system.
            </p>
          </div>
        ) : (
          <div className="border-border bg-card mt-6 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-border bg-primary-tint border-b">
                  <th className="label-caps text-muted-foreground px-4 py-3">Name</th>
                  <th className="label-caps text-muted-foreground px-4 py-3">Location</th>
                  <th className="label-caps text-muted-foreground px-4 py-3">Login</th>
                  <th className="label-caps text-muted-foreground px-4 py-3">Status</th>
                  <th className="label-caps text-muted-foreground px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="border-border border-b last:border-0">
                    <td className="px-4 py-3 text-sm font-medium">{tenant.name}</td>
                    <td className="text-muted-foreground px-4 py-3 text-sm">{tenant.location}</td>
                    <td className="text-muted-foreground px-4 py-3 text-sm">
                      {tenant.users[0]?.email ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-primary/10 text-primary inline-block rounded px-2 py-1 text-[11px] font-semibold tracking-wide uppercase">
                        {tenant.status}
                      </span>
                    </td>
                    <td className="data-mono text-muted-foreground px-4 py-3">
                      {dateFormat.format(tenant.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </PlatformShell>
  );
}
