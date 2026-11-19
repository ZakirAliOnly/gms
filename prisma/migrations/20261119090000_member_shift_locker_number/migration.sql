CREATE TYPE "MemberShift" AS ENUM ('MORNING', 'EVENING');
ALTER TABLE "Member" ADD COLUMN "shift" "MemberShift";
ALTER TABLE "MembershipExtra" ADD COLUMN "lockerNumber" TEXT;
CREATE UNIQUE INDEX "MembershipExtra_tenantId_lockerNumber_key" ON "MembershipExtra"("tenantId", "lockerNumber");
