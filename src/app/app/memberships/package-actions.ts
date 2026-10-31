"use server";

import { revalidatePath } from "@/lib/workspace-cache";
import { activityTransaction } from "@/lib/activity-write";
import { tenantDb } from "@/lib/tenant-db";
import { createPackageSchema, updatePackageSchema } from "@/lib/validators/package";

export type PackageState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function flatten(error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } }) {
  const f = error.flatten().fieldErrors;
  return {
    name: f.name?.[0] ?? "",
    price: f.price?.[0] ?? "",
    whatsIncluded: f.whatsIncluded?.[0] ?? "",
  };
}

/** Creates a membership package (FR-14). */
export async function createPackage(
  _prev: PackageState,
  formData: FormData
): Promise<PackageState> {
  const { db, tenantId, userId } = await tenantDb("memberships", "edit");

  const parsed = createPackageSchema.safeParse({
    name: formData.get("name"),
    price: formData.get("price"),
    whatsIncluded: formData.get("whatsIncluded"),
  });

  if (!parsed.success) return { fieldErrors: flatten(parsed.error) };

  const { name, price, whatsIncluded, durationMonths } = parsed.data;

  // Package names are unique per tenant, so give a clear message rather than
  // letting the constraint surface as a 500.
  const clash = await db.package.findFirst({
    where: { tenantId, name },
    select: { id: true },
  });

  if (clash) {
    return { fieldErrors: { name: "A package with that name already exists." } };
  }

  await activityTransaction(db, { tenantId, actorId: userId, action: "PACKAGE_CREATE" }, (tx) =>
    tx.package.create({
      data: {
        tenantId,
        name,
        price,
        whatsIncluded: whatsIncluded || null,
        durationMonths,
        isActive: true,
      },
    })
  );

  revalidatePath("/app/memberships");
  revalidatePath("/admin/activity-log");
  return { ok: true };
}

/** Edits a package. Existing memberships keep pointing at it. */
export async function updatePackage(
  _prev: PackageState,
  formData: FormData
): Promise<PackageState> {
  const { db, tenantId, userId } = await tenantDb("memberships", "edit");

  const parsed = updatePackageSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    price: formData.get("price"),
    whatsIncluded: formData.get("whatsIncluded"),
  });

  if (!parsed.success) return { fieldErrors: flatten(parsed.error) };

  const { id, name, price, whatsIncluded } = parsed.data;

  // The id came from the client, so confirm it belongs to this tenant.
  const existing = await db.package.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });

  if (!existing) return { error: "Package not found." };

  const clash = await db.package.findFirst({
    where: { tenantId, name, id: { not: id } },
    select: { id: true },
  });

  if (clash) {
    return { fieldErrors: { name: "A package with that name already exists." } };
  }

  await activityTransaction(
    db,
    { tenantId, actorId: userId, action: "PACKAGE_EDIT", target: id },
    (tx) =>
      tx.package.update({
        where: { id },
        data: { name, price, whatsIncluded: whatsIncluded || null },
      })
  );

  revalidatePath("/app/memberships");
  revalidatePath("/admin/activity-log");
  return { ok: true };
}

/**
 * Retires or restores a package.
 *
 * Packages are never deleted: memberships reference them, and removing one
 * would orphan every member on it and break historical reporting. Retiring
 * hides it from the "add member" picker while leaving existing memberships
 * intact.
 */
export async function togglePackage(
  _prev: PackageState,
  formData: FormData
): Promise<PackageState> {
  const { db, tenantId, userId } = await tenantDb("memberships", "edit");

  const id = String(formData.get("id") ?? "");
  const existing = await db.package.findFirst({
    where: { id, tenantId },
    select: { id: true, isActive: true },
  });

  if (!existing) return { error: "Package not found." };

  await activityTransaction(
    db,
    { tenantId, actorId: userId, action: "PACKAGE_STATUS", target: id },
    (tx) =>
      tx.package.update({
        where: { id },
        data: { isActive: !existing.isActive },
      })
  );

  revalidatePath("/app/memberships");
  revalidatePath("/admin/activity-log");
  return { ok: true };
}
