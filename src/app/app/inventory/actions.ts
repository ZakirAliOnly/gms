"use server";

import { revalidatePath } from "@/lib/workspace-cache";
import { activityTransaction } from "@/lib/activity-write";
import { tenantDb } from "@/lib/tenant-db";
import { adjustStockSchema, productSchema, updateProductSchema } from "@/lib/validators/product";
import { deleteProductPhoto, saveProductPhoto } from "@/lib/product-photo";
import { receiveStock } from "@/lib/stock";
import { adjustInventory } from "@/lib/adjust-stock";
import { BusinessError } from "@/lib/transaction";

export type ProductState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function fields(error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } }) {
  const f = error.flatten().fieldErrors;
  return {
    name: f.name?.[0] ?? "",
    category: f.category?.[0] ?? "",
    photo: f.photo?.[0] ?? "",
    costPrice: f.costPrice?.[0] ?? "",
    salePrice: f.salePrice?.[0] ?? "",
    quantity: f.quantity?.[0] ?? "",
    reorderLevel: f.reorderLevel?.[0] ?? "",
  };
}

/** Adds a retail product (FR-24). Opening stock is recorded as a movement. */
export async function createProduct(
  _prev: ProductState,
  formData: FormData
): Promise<ProductState> {
  const { db, tenantId, userId } = await tenantDb("inventory", "edit");

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    photo: formData.get("photo"),
    costPrice: formData.get("costPrice"),
    salePrice: formData.get("salePrice"),
    quantity: formData.get("quantity"),
    reorderLevel: formData.get("reorderLevel"),
  });

  if (!parsed.success) return { fieldErrors: fields(parsed.error) };

  const { name, category, photo, costPrice, salePrice, quantity, reorderLevel } = parsed.data;

  // Write the photo before opening the transaction - a disk write should not
  // hold one open.
  let photoUrl: string | null = null;
  if (photo && photo.startsWith("data:image/")) {
    try {
      photoUrl = await saveProductPhoto(photo);
    } catch (error) {
      return {
        fieldErrors: {
          photo: error instanceof Error ? error.message : "Photo could not be saved.",
        },
      };
    }
  }

  await activityTransaction(
    db,
    { tenantId, actorId: userId, action: "PRODUCT_CREATE", meta: { name, quantity } },
    async (tx) => {
      // Next serial for this tenant, starting at 1. Derived inside the
      // transaction so two concurrent creates cannot read the same value; the
      // unique index on (tenantId, serial) rejects a collision if they do.
      const last = await tx.product.findFirst({
        where: { tenantId },
        orderBy: { serial: "desc" },
        select: { serial: true },
      });

      const product = await tx.product.create({
        data: {
          tenantId,
          serial: (last?.serial ?? 0) + 1,
          name,
          category: category || null,
          photoUrl,
          costPrice,
          salePrice,
          quantity,
          reorderLevel,
        },
      });

      // Stock never changes without a movement behind it (FR-26).
      if (quantity > 0) {
        await receiveStock(tx, tenantId, product.id, quantity, costPrice, "OpeningStock");
        await tx.stockMovement.create({
          data: {
            tenantId,
            productId: product.id,
            quantityDelta: quantity,
            type: "ADJUSTMENT",
            reason: "Opening stock",
          },
        });
      }

      return product;
    }
  );

  revalidatePath("/app");
  revalidatePath("/app/reports");
  revalidatePath("/app/inventory");
  revalidatePath("/app/invoices");
  revalidatePath("/admin/activity-log");
  return { ok: true };
}

/**
 * Edits a product's details.
 *
 * Quantity is deliberately not editable here - stock moves only through
 * documented adjustments, sales, and purchases, so the movement history
 * always explains the current count.
 *
 * The photo field is a three-way switch: a data: URL replaces it (and the
 * old file is deleted), "__remove__" clears it, and "" leaves it untouched.
 */
export async function updateProduct(
  _prev: ProductState,
  formData: FormData
): Promise<ProductState> {
  const { db, tenantId, userId } = await tenantDb("inventory", "edit");

  const parsed = updateProductSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    category: formData.get("category"),
    photo: formData.get("photo"),
    costPrice: formData.get("costPrice"),
    salePrice: formData.get("salePrice"),
    quantity: formData.get("quantity"),
    reorderLevel: formData.get("reorderLevel"),
  });

  if (!parsed.success) return { fieldErrors: fields(parsed.error) };

  const { id, name, category, photo, costPrice, salePrice, reorderLevel } = parsed.data;

  const existing = await db.product.findFirst({
    where: { id, tenantId },
    select: { id: true, photoUrl: true },
  });
  if (!existing) return { error: "Product not found." };

  let photoUpdate: { photoUrl?: string | null } = {};
  const oldPhoto = existing.photoUrl;
  if (photo === "__remove__") {
    photoUpdate = { photoUrl: null };
  } else if (photo && photo.startsWith("data:image/")) {
    try {
      photoUpdate = { photoUrl: await saveProductPhoto(photo) };
    } catch (error) {
      return {
        fieldErrors: {
          photo: error instanceof Error ? error.message : "Photo could not be saved.",
        },
      };
    }
  }

  await activityTransaction(
    db,
    { tenantId, actorId: userId, action: "PRODUCT_EDIT", target: id },
    (tx) =>
      tx.product.update({
        where: { id },
        data: {
          name,
          category: category || null,
          costPrice,
          salePrice,
          reorderLevel,
          ...photoUpdate,
        },
      })
  );

  if ((photo === "__remove__" || photo?.startsWith("data:image/")) && oldPhoto) {
    await deleteProductPhoto(oldPhoto);
  }

  revalidatePath("/app");
  revalidatePath("/app/reports");
  revalidatePath("/app/inventory");
  revalidatePath("/app/invoices");
  revalidatePath("/admin/activity-log");
  return { ok: true };
}

/** Records a manual stock correction with a reason (FR-27). */
export async function adjustStock(_prev: ProductState, formData: FormData): Promise<ProductState> {
  const { db, tenantId, userId } = await tenantDb("inventory", "edit");

  const parsed = adjustStockSchema.safeParse({
    id: formData.get("id"),
    delta: formData.get("delta"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    return { fieldErrors: { delta: f.delta?.[0] ?? "", reason: f.reason?.[0] ?? "" } };
  }

  const { id, delta, reason } = parsed.data;

  if (delta === 0) return { fieldErrors: { delta: "Enter a non-zero amount." } };

  try {
    await adjustInventory(db, tenantId, userId, id, delta, reason);
  } catch (error) {
    if (error instanceof BusinessError) return { fieldErrors: { delta: error.message } };
    throw error;
  }

  revalidatePath("/app");
  revalidatePath("/app/reports");
  revalidatePath("/app/inventory");
  revalidatePath("/app/invoices");
  revalidatePath("/app");
  revalidatePath("/admin/activity-log");
  return { ok: true };
}

/** Hides a product from the catalogue without losing its sales history. */
export async function toggleProduct(
  _prev: ProductState,
  formData: FormData
): Promise<ProductState> {
  const { db, tenantId, userId } = await tenantDb("inventory", "edit");

  const id = String(formData.get("id") ?? "");
  const existing = await db.product.findFirst({
    where: { id, tenantId },
    select: { id: true, isActive: true },
  });
  if (!existing) return { error: "Product not found." };

  await activityTransaction(
    db,
    { tenantId, actorId: userId, action: "PRODUCT_STATUS", target: id },
    (tx) => tx.product.update({ where: { id }, data: { isActive: !existing.isActive } })
  );

  revalidatePath("/app");
  revalidatePath("/app/reports");
  revalidatePath("/app/inventory");
  revalidatePath("/app/invoices");
  revalidatePath("/admin/activity-log");
  return { ok: true };
}
