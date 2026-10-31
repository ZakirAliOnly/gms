"use server";

import { revalidatePath } from "@/lib/workspace-cache";
import { z } from "zod";
import { activityTransaction } from "@/lib/activity-write";
import { tenantDb } from "@/lib/tenant-db";

const extraSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  fee: z.coerce
    .number({ error: "Enter a valid fee." })
    .nonnegative("Fee cannot be negative.")
    .max(9_999_999_999, "Fee is too large."),
});

export type ExtraState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function fields(error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } }) {
  const f = error.flatten().fieldErrors;
  return { name: f.name?.[0] ?? "", fee: f.fee?.[0] ?? "" };
}

export async function createExtra(_prev: ExtraState, formData: FormData): Promise<ExtraState> {
  const { db, tenantId, userId } = await tenantDb("memberships", "edit");

  const parsed = extraSchema.safeParse({
    name: formData.get("name"),
    fee: formData.get("fee"),
  });
  if (!parsed.success) return { fieldErrors: fields(parsed.error) };

  const { name, fee } = parsed.data;

  const clash = await db.extra.findFirst({
    where: { tenantId, name },
    select: { id: true },
  });
  if (clash) return { fieldErrors: { name: "An extra with that name already exists." } };

  await activityTransaction(db, { tenantId, actorId: userId, action: "EXTRA_CREATE" }, (tx) =>
    tx.extra.create({ data: { tenantId, name, fee, isActive: true } })
  );

  revalidatePath("/app/memberships");
  revalidatePath("/admin/activity-log");
  return { ok: true };
}

/**
 * Edits an extra.
 *
 * A new fee applies to memberships added from now on. Memberships already
 * carrying this extra keep the fee they were signed up at - MembershipExtra
 * snapshots it, so a price rise never silently rewrites what an existing
 * member is charged.
 */
export async function updateExtra(_prev: ExtraState, formData: FormData): Promise<ExtraState> {
  const { db, tenantId, userId } = await tenantDb("memberships", "edit");

  const id = String(formData.get("id") ?? "");
  const parsed = extraSchema.safeParse({
    name: formData.get("name"),
    fee: formData.get("fee"),
  });
  if (!parsed.success) return { fieldErrors: fields(parsed.error) };

  const { name, fee } = parsed.data;

  const existing = await db.extra.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return { error: "Extra not found." };

  const clash = await db.extra.findFirst({
    where: { tenantId, name, id: { not: id } },
    select: { id: true },
  });
  if (clash) return { fieldErrors: { name: "An extra with that name already exists." } };

  await activityTransaction(
    db,
    { tenantId, actorId: userId, action: "EXTRA_EDIT", target: id },
    (tx) => tx.extra.update({ where: { id }, data: { name, fee } })
  );

  revalidatePath("/app/memberships");
  revalidatePath("/admin/activity-log");
  return { ok: true };
}

/**
 * Retires or restores an extra.
 *
 * Never deleted: memberships reference it, and removing one would break what a
 * member is recorded as paying for.
 */
export async function toggleExtra(_prev: ExtraState, formData: FormData): Promise<ExtraState> {
  const { db, tenantId, userId } = await tenantDb("memberships", "edit");

  const id = String(formData.get("id") ?? "");
  const existing = await db.extra.findFirst({
    where: { id, tenantId },
    select: { id: true, isActive: true },
  });
  if (!existing) return { error: "Extra not found." };

  await activityTransaction(
    db,
    { tenantId, actorId: userId, action: "EXTRA_STATUS", target: id },
    (tx) => tx.extra.update({ where: { id }, data: { isActive: !existing.isActive } })
  );

  revalidatePath("/app/memberships");
  revalidatePath("/admin/activity-log");
  return { ok: true };
}

/**
 * Sets which extras a membership carries.
 *
 * Replaces the whole set rather than diffing: the form posts every checked
 * extra, so anything absent has been removed. Each kept extra snapshots the
 * extra's current fee.
 */
export async function setMembershipExtras(
  _prev: ExtraState,
  formData: FormData
): Promise<ExtraState> {
  const { db, tenantId, userId } = await tenantDb("memberships", "edit");

  const membershipId = String(formData.get("membershipId") ?? "");
  const chosenIds = formData.getAll("extraIds").map(String).filter(Boolean);

  const membership = await db.membership.findFirst({
    where: { id: membershipId, tenantId },
    select: { id: true },
  });
  if (!membership) return { error: "Membership not found." };

  // Only this tenant's active extras can be attached.
  const extras = chosenIds.length
    ? await db.extra.findMany({
        where: { id: { in: chosenIds }, tenantId, isActive: true },
        select: { id: true, fee: true },
      })
    : [];

  await activityTransaction(
    db,
    { tenantId, actorId: userId, action: "MEMBERSHIP_EXTRAS", target: membershipId },
    async (tx) => {
      await tx.membershipExtra.deleteMany({ where: { membershipId, tenantId } });

      if (extras.length) {
        await tx.membershipExtra.createMany({
          data: extras.map((e) => ({
            tenantId,
            membershipId,
            extraId: e.id,
            fee: e.fee,
          })),
        });
      }
    }
  );

  revalidatePath("/app/memberships");
  revalidatePath("/app");
  revalidatePath("/admin/activity-log");
  return { ok: true };
}
