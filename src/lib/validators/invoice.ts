import { z } from "zod";

export const invoiceLineSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).max(2147483647),
});

export const createInvoiceSchema = z.object({
  lines: z.array(invoiceLineSchema).min(1, "Add at least one item.").max(100),
  discount: z.coerce
    .number()
    .nonnegative("Discount cannot be negative.")
    .multipleOf(0.01)
    .max(9999999999.99)
    .default(0),
  paymentMethodId: z.string().trim().min(1, "Select a payment method."),
  memberId: z.string().trim().optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
