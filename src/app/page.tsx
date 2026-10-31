import { redirect } from "next/navigation";
import { requireRole } from "@/lib/guards";
import { firstAccessiblePath } from "@/lib/module-access";
import { homeForRole } from "@/lib/routes";

/**
 * "/" is a router, never a destination. Middleware already sends
 * unauthenticated traffic to the login screen; this handles a signed-in user
 * landing here and forwards them to the home for their role.
 */
export default async function RootPage() {
  const user = await requireRole("TENANT", "ADMIN", "SUPERADMIN");
  redirect(user.role === "TENANT" ? firstAccessiblePath(user) : homeForRole(user.role));
}
