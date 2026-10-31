"use server";

import { revalidatePath } from "@/lib/workspace-cache";
import { addMonths } from "date-fns";
import { activityTransaction } from "@/lib/activity-write";
import { tenantDb } from "@/lib/tenant-db";
import {
  createMembershipSchema,
  renewMembershipSchema,
  updateMembershipSchema,
} from "@/lib/validators/membership";
import { deleteMemberPhoto, saveMemberPhoto } from "@/lib/member-photo";

import { membershipReceipt } from "@/lib/membership-receipt";
import type { InvoiceReceipt } from "../invoices/invoice-receipt";

export type ActionState = {
  receipt?: InvoiceReceipt;
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Set after a successful create, so the caller can offer the barcode. */
  created?: { memberName: string; barcode: string; packageName: string };
};

/** IR + 6 digits, unique within the tenant. */
async function generateBarcode(
  db: Awaited<ReturnType<typeof tenantDb>>["db"],
  tenantId: string
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = `IR${Math.floor(100000 + Math.random() * 900000)}`;
    const clash = await db.member.findFirst({
      where: { tenantId, barcode: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  throw new Error("Could not generate a unique barcode.");
}

/**
 * Creates a member and their single membership together (FR-13, FR-15).
 * The two are one unit - a member with no membership is not a thing this
 * product models.
 */
export async function createMembership(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, tenantId, userId } = await tenantDb("memberships", "edit");

  const parsed = createMembershipSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    cnic: formData.get("cnic"),
    joinDate: formData.get("joinDate"),
    packageId: formData.get("packageId"),
    photo: formData.get("photo"),
    extraIds: formData.getAll("extraIds").map(String),
    amountPaid: formData.get("amountPaid"),
    paymentMethodId: formData.get("paymentMethodId"),
    renewalDate: formData.get("renewalDate"),
  });

  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        name: f.name?.[0] ?? "",
        phone: f.phone?.[0] ?? "",
        email: f.email?.[0] ?? "",
        cnic: f.cnic?.[0] ?? "",
        packageId: f.packageId?.[0] ?? "",
        amountPaid: f.amountPaid?.[0] ?? "",
        paymentMethodId: f.paymentMethodId?.[0] ?? "",
        renewalDate: f.renewalDate?.[0] ?? "",
      },
    };
  }

  const {
    name,
    phone,
    email,
    cnic,
    joinDate,
    packageId,
    photo,
    extraIds,
    amountPaid,
    paymentMethodId,
    renewalDate,
  } = parsed.data;

  // Re-check the package belongs to this tenant: the id came from the client.
  const pkg = await db.package.findFirst({
    where: { id: packageId, tenantId, isActive: true },
    select: { id: true, name: true },
  });

  if (!pkg) {
    return { fieldErrors: { packageId: "That package is not available." } };
  }

  const method = await db.paymentMethod.findFirst({
    where: { id: paymentMethodId, tenantId, isActive: true },
    select: { id: true },
  });
  if (!method) {
    return { fieldErrors: { paymentMethodId: "That payment method is not available." } };
  }

  const chosenExtras = extraIds.length
    ? await db.extra.findMany({
        where: { id: { in: extraIds }, tenantId, isActive: true },
        select: { id: true, fee: true },
      })
    : [];

  // Store the webcam capture before opening the transaction - a slow disk
  // write should not hold a DB transaction open.
  let photoUrl: string | null = null;
  if (photo && photo.startsWith("data:image/")) {
    try {
      photoUrl = await saveMemberPhoto(photo);
    } catch (error) {
      return {
        fieldErrors: { name: error instanceof Error ? error.message : "Photo could not be saved." },
      };
    }
  }

  const barcode = await generateBarcode(db, tenantId);
  const now = new Date();
  const joined = joinDate ? new Date(joinDate) : now;
  // First renewal: the date the user picked, else one month after joining.
  const firstRenewal = renewalDate ? new Date(renewalDate) : addMonths(joined, 1);

  const receipt = await activityTransaction(
    db,
    {
      tenantId,
      actorId: userId,
      action: "MEMBERSHIP_CREATE",
      target: barcode,
      meta: { name, number: barcode, amount: amountPaid },
    },
    async (tx) => {
      const member = await tx.member.create({
        data: {
          tenantId,
          name,
          phone,
          email: email || null,
          cnic: cnic || null,
          photoUrl,
          barcode,
          joinDate: joined,
        },
      });

      const membership = await tx.membership.create({
        data: {
          tenantId,
          memberId: member.id,
          packageId,
          startDate: joined,
          // First renewal date - defaults to one month after joining (FR-16),
          // but the add form lets the user set it explicitly.
          nextRenewalDate: firstRenewal,
          status: "ACTIVE",
        },
      });

      if (chosenExtras.length) {
        await tx.membershipExtra.createMany({
          data: chosenExtras.map((e) => ({
            tenantId,
            membershipId: membership.id,
            extraId: e.id,
            // Snapshot the fee: a later price change never rewrites this.
            fee: e.fee,
          })),
        });
      }

      // The joining payment is the first renewal. It covers the period from
      // joining to one month later - the same window nextRenewalDate points at.
      const payment = await tx.renewalPayment.create({
        data: {
          tenantId,
          membershipId: membership.id,
          amount: amountPaid,
          kind: "ADMISSION",
          paymentMethodId,
          recordedAt: joined,
          periodStart: joined,
          periodEnd: firstRenewal,
        },
      });
      return membershipReceipt(tx, tenantId, payment.id, "Membership receipt");
    }
  );

  revalidatePath("/app/memberships");
  revalidatePath("/app/payment-methods");
  revalidatePath("/app");
  revalidatePath("/admin/activity-log");
  return {
    ok: true,
    receipt,
    created: { memberName: name, barcode, packageName: pkg.name },
  };
}

/**
 * Edits an existing member and their membership.
 *
 * The photo field is a three-way switch: a data: URL replaces the headshot
 * (and the old file is deleted), the literal "__remove__" clears it, and an
 * empty string leaves the current one untouched.
 *
 * Extras are replaced wholesale from what the form submits - anything not in
 * the list has been unticked. Kept extras snapshot the extra's current fee.
 */
export async function updateMembership(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, tenantId, userId } = await tenantDb("memberships", "edit");

  const parsed = updateMembershipSchema.safeParse({
    membershipId: formData.get("membershipId"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    cnic: formData.get("cnic"),
    joinDate: formData.get("joinDate"),
    packageId: formData.get("packageId"),
    photo: formData.get("photo"),
    extraIds: formData.getAll("extraIds").map(String),
  });

  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        name: f.name?.[0] ?? "",
        phone: f.phone?.[0] ?? "",
        email: f.email?.[0] ?? "",
        cnic: f.cnic?.[0] ?? "",
        packageId: f.packageId?.[0] ?? "",
      },
    };
  }

  const { membershipId, name, phone, email, cnic, joinDate, packageId, photo, extraIds } =
    parsed.data;

  const membership = await db.membership.findFirst({
    where: { id: membershipId, tenantId },
    select: { id: true, memberId: true, member: { select: { photoUrl: true } } },
  });
  if (!membership) return { error: "Member not found." };

  const pkg = await db.package.findFirst({
    where: { id: packageId, tenantId },
    select: { id: true },
  });
  if (!pkg) return { fieldErrors: { packageId: "That package is not available." } };

  const chosenExtras = extraIds.length
    ? await db.extra.findMany({
        where: { id: { in: extraIds }, tenantId, isActive: true },
        select: { id: true, fee: true },
      })
    : [];

  // Resolve the photo change outside the transaction.
  let photoUpdate: { photoUrl?: string | null } = {};
  const oldPhoto = membership.member.photoUrl;
  if (photo === "__remove__") {
    photoUpdate = { photoUrl: null };
  } else if (photo && photo.startsWith("data:image/")) {
    try {
      photoUpdate = { photoUrl: await saveMemberPhoto(photo) };
    } catch (error) {
      return {
        fieldErrors: {
          name: error instanceof Error ? error.message : "Photo could not be saved.",
        },
      };
    }
  }

  const joined = joinDate ? new Date(joinDate) : undefined;

  await activityTransaction(
    db,
    { tenantId, actorId: userId, action: "MEMBERSHIP_EDIT", target: membershipId, meta: { name } },
    async (tx) => {
      await tx.member.update({
        where: { id: membership.memberId },
        data: {
          name,
          phone,
          email: email || null,
          cnic: cnic || null,
          ...photoUpdate,
          ...(joined ? { joinDate: joined } : {}),
        },
      });

      // Package can change; the renewal schedule is not touched here.
      await tx.membership.update({
        where: { id: membership.id },
        data: { packageId },
      });

      // Replace the extras set.
      await tx.membershipExtra.deleteMany({ where: { membershipId: membership.id, tenantId } });
      if (chosenExtras.length) {
        await tx.membershipExtra.createMany({
          data: chosenExtras.map((e) => ({
            tenantId,
            membershipId: membership.id,
            extraId: e.id,
            fee: e.fee,
          })),
        });
      }
    }
  );

  // Old file removed only after the row no longer points at it.
  if ((photo === "__remove__" || photo?.startsWith("data:image/")) && oldPhoto) {
    await deleteMemberPhoto(oldPhoto);
  }

  revalidatePath("/app/memberships");
  revalidatePath("/app");
  revalidatePath("/admin/activity-log");
  return { ok: true };
}

export type PaymentHistoryRow = {
  id: string;
  amount: string;
  method: string;
  recordedAt: string;
  periodStart: string;
  periodEnd: string;
};

/**
 * The renewal payments recorded against one membership, newest first.
 * Used by the member details view.
 */
export async function getMemberPayments(membershipId: string): Promise<PaymentHistoryRow[]> {
  const { db, tenantId } = await tenantDb("memberships");

  // membershipId came from the client, so it is filtered by tenant here.
  const rows = await db.renewalPayment.findMany({
    where: { membershipId, tenantId },
    orderBy: { recordedAt: "desc" },
    select: {
      id: true,
      amount: true,
      recordedAt: true,
      periodStart: true,
      periodEnd: true,
      paymentMethod: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    amount: r.amount.toString(),
    method: r.paymentMethod.name,
    recordedAt: r.recordedAt.toISOString(),
    periodStart: r.periodStart.toISOString(),
    periodEnd: r.periodEnd.toISOString(),
  }));
}

export async function getPaymentReceipt(
  paymentId: string
): Promise<{ invoice?: InvoiceReceipt; error?: string }> {
  const { db, tenantId } = await tenantDb("memberships");
  if (typeof paymentId !== "string" || !paymentId.trim()) return { error: "Payment not found." };
  const payment = await db.renewalPayment.findFirst({
    where: { id: paymentId, tenantId },
    select: { id: true },
  });
  if (!payment) return { error: "Payment not found." };
  return { invoice: await membershipReceipt(db, tenantId, payment.id) };
}

/**
 * Records a renewal payment and advances the schedule (FR-18, FR-19).
 *
 * The next due date is one month from the date the renewal was RECORDED, not
 * from the old due date - so a late payment pushes the schedule forward and no
 * catch-up charge accrues (decision D-7).
 */
export async function renewMembership(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { db, tenantId, userId } = await tenantDb("memberships", "edit");

  const parsed = renewMembershipSchema.safeParse({
    membershipId: formData.get("membershipId"),
    paymentMethodId: formData.get("paymentMethodId"),
    amount: formData.get("amount"),
  });

  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        paymentMethodId: f.paymentMethodId?.[0] ?? "",
        amount: f.amount?.[0] ?? "",
      },
    };
  }

  const { membershipId, paymentMethodId, amount } = parsed.data;

  // Both ids arrived from the client, so both are re-checked against this
  // tenant before anything is written.
  const [membership, method] = await Promise.all([
    db.membership.findFirst({
      where: { id: membershipId, tenantId },
      select: { id: true, nextRenewalDate: true },
    }),
    db.paymentMethod.findFirst({
      where: { id: paymentMethodId, tenantId, isActive: true },
      select: { id: true },
    }),
  ]);

  if (!membership) return { error: "Membership not found." };
  if (!method) return { fieldErrors: { paymentMethodId: "That payment method is not available." } };

  const recordedAt = new Date();
  const nextRenewalDate = addMonths(recordedAt, 1);

  const receipt = await activityTransaction(
    db,
    {
      tenantId,
      actorId: userId,
      action: "MEMBERSHIP_RENEW",
      target: membershipId,
      meta: { amount },
    },
    async (tx) => {
      const payment = await tx.renewalPayment.create({
        data: {
          tenantId,
          membershipId: membership.id,
          amount,
          paymentMethodId,
          recordedAt,
          periodStart: membership.nextRenewalDate,
          periodEnd: nextRenewalDate,
        },
      });

      await tx.membership.update({
        where: { id: membership.id },
        data: { nextRenewalDate, status: "ACTIVE" },
      });
      return membershipReceipt(tx, tenantId, payment.id, "Renewal receipt");
    }
  );

  revalidatePath("/app/memberships");
  revalidatePath("/app/payment-methods");
  revalidatePath("/app");
  revalidatePath("/admin/activity-log");
  return { ok: true, receipt };
}
