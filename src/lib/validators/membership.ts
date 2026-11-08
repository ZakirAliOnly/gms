import { z } from "zod";
import { whatsappPhone } from "../whatsapp";

/** 13 digits, dashes stripped by the client. Optional. */
const cnicField = z
  .union([
    z
      .string()
      .trim()
      .regex(/^\d{13}$/, "CNIC must be 13 digits."),
    z.literal(""),
  ])
  .optional();

/** Every extra id the form carries, deduped. Empty when none picked. */
const extraIdsField = z
  .union([z.array(z.string().trim().min(1)), z.string().trim().min(1)])
  .optional()
  .transform((v) => {
    if (!v) return [] as string[];
    const list = Array.isArray(v) ? v : [v];
    return [...new Set(list)];
  });

const memberFields = {
  name: z.string().trim().min(1, "Name is required.").max(120),
  phone: z
    .string({ error: "WhatsApp number is required." })
    .trim()
    .min(1, "WhatsApp number is required.")
    .transform((value, context) => {
      const normalized = whatsappPhone(value);
      if (!normalized) {
        context.addIssue({
          code: "custom",
          message: "Enter a valid WhatsApp number, e.g. 03001234567 or +923001234567.",
        });
        return z.NEVER;
      }
      return `+${normalized}`;
    }),
  email: z.union([z.string().trim().email("Enter a valid email."), z.literal("")]).optional(),
  cnic: cnicField,
  joinDate: z.string().trim().optional(),
  packageId: z.string().trim().min(1, "Select a package."),
  /** data: URL from the webcam capture, "" to keep the current, "__remove__" to clear. */
  photo: z.string().trim().optional(),
  extraIds: extraIdsField,
};

export const createMembershipSchema = z.object({
  ...memberFields,
  /** The joining payment - recorded as the first renewal. */
  amountPaid: z.coerce
    .number({ error: "Enter a valid amount." })
    .positive("Amount must be greater than zero."),
  paymentMethodId: z.string().trim().min(1, "Select a payment method."),
  /** First renewal due date. Blank -> one month after joining. */
  renewalDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.")
    .optional()
    .or(z.literal("")),
});

export const updateMembershipSchema = z.object({
  membershipId: z.string().trim().min(1),
  ...memberFields,
});

export const renewMembershipSchema = z.object({
  membershipId: z.string().trim().min(1),
  paymentMethodId: z.string().trim().min(1, "Select a payment method."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
});
