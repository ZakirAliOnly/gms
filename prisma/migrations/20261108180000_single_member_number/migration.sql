-- Consolidate the in-progress two-field design into one shared contact number.
-- Prefer the WhatsApp recipient already entered; retain the prior phone if absent.
UPDATE "Member" SET phone = '+' || "whatsappNumber" WHERE "whatsappNumber" IS NOT NULL;
ALTER TABLE "Member" DROP COLUMN "whatsappNumber";
