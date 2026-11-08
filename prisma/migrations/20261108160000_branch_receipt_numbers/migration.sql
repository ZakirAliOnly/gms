ALTER TABLE "Tenant" ADD COLUMN "receiptPrefix" TEXT, ADD COLUMN "receiptSequence" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RenewalPayment" ADD COLUMN "receiptNumber" TEXT;

-- Reserve a distinct three-letter prefix per branch, including existing branches.
DO $$
DECLARE
  branch RECORD;
  branch_label TEXT;
  words TEXT[];
  preferred TEXT;
  candidate TEXT;
  prefix_index INTEGER;
  candidate_index INTEGER;
  attempt INTEGER;
BEGIN
  FOR branch IN SELECT id, name, location FROM "Tenant" ORDER BY "createdAt", id LOOP
    branch_label := CASE WHEN regexp_replace(lower(branch.name), '[^a-z0-9]', '', 'g') IN ('goldsgym', 'goldengym') THEN branch.location ELSE branch.name END;
    branch_label := COALESCE(NULLIF(btrim(branch_label), ''), 'Main Branch');
    IF branch_label !~* '\mbranch\M' THEN branch_label := branch_label || ' Branch'; END IF;
    words := regexp_split_to_array(btrim(regexp_replace(upper(branch_label), '[^A-Z]+', ' ', 'g')), '\s+');
    preferred := CASE WHEN cardinality(words) >= 3 THEN left(words[1], 1) || left(words[2], 1) || left(words[3], 1)
      WHEN cardinality(words) = 2 THEN left(words[1], 1) || left(words[2], 2)
      ELSE COALESCE(NULLIF(left(words[1], 3), ''), 'BRN') END;
    preferred := rpad(preferred, 3, 'X');
    prefix_index := (ascii(substr(preferred, 1, 1)) - 65) * 676 + (ascii(substr(preferred, 2, 1)) - 65) * 26 + ascii(substr(preferred, 3, 1)) - 65;
    FOR attempt IN 0..17575 LOOP
      candidate_index := (prefix_index + attempt) % 17576;
      candidate := chr(65 + candidate_index / 676) || chr(65 + (candidate_index / 26) % 26) || chr(65 + candidate_index % 26);
      IF NOT EXISTS (SELECT 1 FROM "Tenant" WHERE "receiptPrefix" = candidate) THEN EXIT; END IF;
      candidate := NULL;
    END LOOP;
    IF candidate IS NULL THEN RAISE EXCEPTION 'No branch receipt prefixes are available'; END IF;
    UPDATE "Tenant" SET "receiptPrefix" = candidate WHERE id = branch.id;
  END LOOP;
END $$;

-- Historical payments get deterministic numbers; subsequent reprints keep them.
WITH numbered AS (
  SELECT id, "tenantId", row_number() OVER (PARTITION BY "tenantId" ORDER BY "recordedAt", id) AS sequence
  FROM "RenewalPayment"
)
UPDATE "RenewalPayment" AS payment
SET "receiptNumber" = branch."receiptPrefix" || lpad(numbered.sequence::text, greatest(4, length(numbered.sequence::text)), '0')
FROM numbered, "Tenant" AS branch
WHERE payment.id = numbered.id AND branch.id = numbered."tenantId";
UPDATE "Tenant" AS branch SET "receiptSequence" = (SELECT count(*) FROM "RenewalPayment" WHERE "tenantId" = branch.id);

CREATE UNIQUE INDEX "Tenant_receiptPrefix_key" ON "Tenant"("receiptPrefix");
CREATE UNIQUE INDEX "RenewalPayment_tenantId_receiptNumber_key" ON "RenewalPayment"("tenantId", "receiptNumber");
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_receiptPrefix_format" CHECK ("receiptPrefix" ~ '^[A-Z]{3}$');
