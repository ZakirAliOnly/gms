-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT,
    "monthlyWage" DECIMAL(12,2) NOT NULL,
    "extraHoursRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerAdvance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expenseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerExtraHours" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "hours" DECIMAL(6,2) NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerExtraHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerWagePayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "baseWage" DECIMAL(12,2) NOT NULL,
    "extraAmount" DECIMAL(12,2) NOT NULL,
    "absentDays" DECIMAL(5,2) NOT NULL,
    "absenceDeduction" DECIMAL(12,2) NOT NULL,
    "advancesDeducted" DECIMAL(12,2) NOT NULL,
    "netPaid" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expenseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerWagePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Worker_tenantId_isActive_idx" ON "Worker"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerAdvance_expenseId_key" ON "WorkerAdvance"("expenseId");

-- CreateIndex
CREATE INDEX "WorkerAdvance_tenantId_month_idx" ON "WorkerAdvance"("tenantId", "month");

-- CreateIndex
CREATE INDEX "WorkerAdvance_workerId_month_idx" ON "WorkerAdvance"("workerId", "month");

-- CreateIndex
CREATE INDEX "WorkerExtraHours_tenantId_month_idx" ON "WorkerExtraHours"("tenantId", "month");

-- CreateIndex
CREATE INDEX "WorkerExtraHours_workerId_month_idx" ON "WorkerExtraHours"("workerId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerWagePayment_expenseId_key" ON "WorkerWagePayment"("expenseId");

-- CreateIndex
CREATE INDEX "WorkerWagePayment_tenantId_month_idx" ON "WorkerWagePayment"("tenantId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerWagePayment_workerId_month_key" ON "WorkerWagePayment"("workerId", "month");

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAdvance" ADD CONSTRAINT "WorkerAdvance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAdvance" ADD CONSTRAINT "WorkerAdvance_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerExtraHours" ADD CONSTRAINT "WorkerExtraHours_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerWagePayment" ADD CONSTRAINT "WorkerWagePayment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerWagePayment" ADD CONSTRAINT "WorkerWagePayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

