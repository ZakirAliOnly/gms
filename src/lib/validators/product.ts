import { z } from "zod";

export const productSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  category: z.string().trim().max(60).optional(),
  /** data: URL from the file picker, "" to keep / none, "__remove__" to clear. */
  photo: z.string().trim().optional(),
  costPrice: z.coerce
    .number({ error: "Enter a valid cost." })
    .nonnegative("Cost cannot be negative.")
    .multipleOf(0.01, "Cost can have at most two decimal places.")
    .max(9_999_999_999, "Cost is too large."),
  salePrice: z.coerce
    .number({ error: "Enter a valid price." })
    .nonnegative("Price cannot be negative.")
    .multipleOf(0.01, "Price can have at most two decimal places.")
    .max(9_999_999_999, "Price is too large."),
  quantity: z.coerce
    .number({ error: "Enter a valid quantity." })
    .int("Quantity must be a whole number.")
    .min(0, "Quantity cannot be negative.")
    .max(2147483647),
  reorderLevel: z.coerce
    .number({ error: "Enter a valid reorder level." })
    .int("Reorder level must be a whole number.")
    .min(0, "Reorder level cannot be negative.")
    .max(2147483647),
});

export const updateProductSchema = productSchema.extend({
  id: z.string().trim().min(1),
});

export const adjustStockSchema = z.object({
  id: z.string().trim().min(1),
  delta: z.coerce.number({ error: "Enter a number." }).int("Must be a whole number."),
  reason: z.string().trim().min(1, "Give a reason.").max(200),
});
