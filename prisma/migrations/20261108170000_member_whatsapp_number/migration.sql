ALTER TABLE "Member" ADD COLUMN "whatsappNumber" TEXT;
-- Preserve existing members and prefill recognizable mobile numbers.
UPDATE "Member" SET "whatsappNumber" = CASE
  WHEN phone ~ '^03[0-9]{9}$' THEN '92' || substring(phone FROM 2)
  WHEN phone ~ '^3[0-9]{9}$' THEN '92' || phone
  WHEN phone ~ '^92[0-9]{10}$' THEN phone
  WHEN phone ~ '^\+[1-9][0-9]{6,14}$' THEN substring(phone FROM 2)
  WHEN phone ~ '^00[1-9][0-9]{6,14}$' THEN substring(phone FROM 3)
  ELSE NULL END;
ALTER TABLE "Member" ADD CONSTRAINT "Member_whatsappNumber_format" CHECK ("whatsappNumber" ~ '^[1-9][0-9]{6,14}$');
