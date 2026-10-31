import Link from "next/link";
import { WorkspaceProvider } from "@/components/workspace-link";
import { getTenantContext } from "@/lib/tenant-context";
import { AppLayout } from "@/components/app-layout";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * Shared shell for tenant and Admin branch routes.
 *
 * Resolving the tenant context here guards tenant and Admin branch routes:
 * tenant users stay in their own branch, and Admin uses a branch workspace.
 * Deleted or suspended branches are refused. Pages still call
 * getTenantContext() themselves to get the tenantId - it is request-cached, so
 * that costs nothing.
 *
 * SignOutButton is a server component (it wraps a server action), so it is
 * passed into the client nav as a prop rather than imported there.
 */
export async function TenantShell({ children }: { children: React.ReactNode }) {
  const { tenantId, tenantName, userEmail, userName, adminBranch } = await getTenantContext();

  return (
    <WorkspaceProvider value={adminBranch ? `/admin/branches/${tenantId}` : "/app"}>
      <AppLayout
        workspace={tenantName}
        name={userName}
        email={userEmail}
        role={adminBranch ? "Admin" : "Tenant"}
        signOut={<SignOutButton />}
      >
        {adminBranch && (
          <div className="border-border bg-primary/5 border-b px-4 py-3 text-sm">
            <div className="mx-auto flex max-w-[1376px] flex-wrap justify-between gap-2">
              <strong>Admin · Branch: {tenantName}</strong>
              <Link href="/admin" className="text-primary underline">
                All branches / switch branch
              </Link>
            </div>
          </div>
        )}
        {children}
      </AppLayout>
    </WorkspaceProvider>
  );
}
