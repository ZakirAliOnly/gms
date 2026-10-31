import { BRANCH_HEADER, resolveBranchId } from "@/lib/branch-scope";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/guards";
import { LOGIN_ROUTE } from "@/lib/routes";

export type TenantContext = {
  tenantId: string;
  tenantName: string;
  tenantLocation: string;
  userId: string;
  userEmail: string;
  userName: string;
  adminBranch: boolean;
};

/** Tenant users always use their assigned branch. Admin scope is derived by
 * proxy from the branch workspace URL and checked again here for every action. */
export const getTenantContext = cache(async (): Promise<TenantContext> => {
  const user = await requireRole("TENANT", "ADMIN");

  // A TENANT account without a tenantId is a data integrity failure - the
  // creation path always sets it. Refuse rather than fall back to anything.
  const tenantId = resolveBranchId(user.role, user.tenantId, (await headers()).get(BRANCH_HEADER));
  if (!tenantId) {
    redirect(user.role === "ADMIN" ? "/admin" : LOGIN_ROUTE);
  }

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, location: true, status: true },
  });

  // Deleted or suspended after the session was issued: the JWT is still valid
  // but the location is not open for business.
  if (!tenant || tenant.status !== "ACTIVE") {
    redirect(user.role === "ADMIN" ? "/admin" : LOGIN_ROUTE);
  }

  return {
    adminBranch: user.role === "ADMIN",
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantLocation: tenant.location,
    userId: user.id,
    userEmail: user.email ?? "",
    userName: user.name ?? user.email?.split("@")[0] ?? "Team member",
  };
});
