import { TenantNav } from "@/components/tenant-nav";
import { WorkspaceProvider } from "@/components/workspace-link";
import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { AppFooter } from "@/components/app-footer";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * Sticky shell for the platform surfaces (superadmin, admin).
 *
 * Same top-and-bottom sticky arrangement as the tenant portal. Admin includes
 * the tenant module navigation for its combined branch views.
 */
export function PlatformShell({
  role,
  userEmail,
  home,
  children,
}: {
  role: string;
  userEmail: string;
  home: string;
  children: React.ReactNode;
}) {
  if (home === "/admin")
    return (
      <WorkspaceProvider value="/admin">
        <div className="flex min-h-svh flex-col">
          <TenantNav
            admin
            tenantName="All branches"
            userEmail={userEmail}
            signOut={<SignOutButton />}
          />
          <div className="flex-1">{children}</div>
          <AppFooter />
        </div>
      </WorkspaceProvider>
    );
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-border bg-card sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-20 w-full max-w-[1440px] items-center gap-6 px-4 md:px-8">
          <Link href={home} aria-label="Golden GYM home" className="text-primary flex shrink-0 items-center gap-2">
            <Dumbbell className="size-9" aria-hidden="true" />
            <span className="text-sm font-semibold">Golden GYM</span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[13px] leading-tight font-medium">{role}</p>
              <p className="text-muted-foreground max-w-[200px] truncate text-[12px] leading-tight">
                {userEmail}
              </p>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <AppFooter />
    </div>
  );
}
