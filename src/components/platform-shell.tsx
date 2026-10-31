import { WorkspaceProvider } from "@/components/workspace-link";
import { AppLayout } from "@/components/app-layout";
import { SignOutButton } from "@/components/sign-out-button";

export function PlatformShell({
  role,
  userEmail,
  userName,
  home,
  children,
}: {
  role: string;
  userEmail: string;
  userName?: string;
  home: string;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceProvider value={home}>
      <AppLayout
        workspace={home === "/admin" ? "All branches" : "Platform management"}
        name={userName || userEmail.split("@")[0] || role}
        email={userEmail}
        role={role}
        signOut={<SignOutButton />}
      >
        {children}
      </AppLayout>
    </WorkspaceProvider>
  );
}
