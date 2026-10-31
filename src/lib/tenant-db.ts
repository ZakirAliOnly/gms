import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { canAccess, firstAccessiblePath, type ModuleKey } from "./module-access";
import { requireRole } from "./guards";
import { redirect } from "next/navigation";

/**
 * Returns the Prisma client together with the current tenant's id.
 *
 * Every read and write in a tenant module goes through this, and every query
 * must include `tenantId` from it - in the `where` of a read, and in the
 * `data` of a write:
 *
 *   const { db, tenantId } = await tenantDb("memberships", "edit");
 *   const members = await db.member.findMany({ where: { tenantId } });
 *
 * Under the shared-schema model this filter IS the isolation boundary. A query
 * that omits it reads across every location on the platform, so treat a
 * missing tenantId as a security defect, not a bug.
 *
 * Deliberately not a Prisma extension with an automatic filter: an implicit
 * guarantee is easy to bypass without noticing, and Milestone 3 has enough
 * models that a visible, greppable `tenantId` in each query is worth the
 * repetition.
 */
export async function tenantDb(
  module: ModuleKey | "users" | "settings",
  mode: "view" | "edit" = "view"
) {
  const user = await requireRole("TENANT", "ADMIN");
  if (!canAccess(user, module, mode)) redirect(firstAccessiblePath(user));
  const { tenantId, userId } = await getTenantContext();
  return { db, tenantId, userId };
}

/**
 * Records a tenant-scoped action in the audit log. Call inside the same
 * transaction as the change it describes.
 */
export async function auditTenantAction(
  tx: Pick<typeof db, "auditLog">,
  input: {
    actorId: string;
    tenantId: string;
    action: string;
    target: string;
    meta?: Record<string, unknown>;
  }
) {
  await tx.auditLog.create({
    data: {
      actorId: input.actorId,
      tenantId: input.tenantId,
      action: input.action,
      target: input.target,
      meta: input.meta as never,
    },
  });
}
