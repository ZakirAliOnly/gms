ALTER TABLE "User" ADD COLUMN "isBranchManager" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "moduleAccess" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "editableModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RenewalPayment" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'RENEWAL';
UPDATE "RenewalPayment" SET "kind" = 'ADMISSION' WHERE id IN (
  SELECT DISTINCT ON ("membershipId") id FROM "RenewalPayment"
  ORDER BY "membershipId", "recordedAt", id
);
