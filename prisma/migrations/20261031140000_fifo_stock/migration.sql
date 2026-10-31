ALTER TABLE "RetailInvoiceLine" ADD COLUMN "costTotal" DECIMAL(12,2);
CREATE TABLE "StockLot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sequence" SERIAL NOT NULL UNIQUE,
  "tenantId" TEXT NOT NULL,
  "productId" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
  "remaining" INTEGER NOT NULL CHECK ("remaining" >= 0 AND "remaining" <= "quantity"),
  "unitCost" DECIMAL(12,2) NOT NULL CHECK ("unitCost" >= 0),
  "source" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "StockLot_tenantId_productId_receivedAt_idx" ON "StockLot"("tenantId", "productId", "receivedAt");
CREATE TABLE "StockAllocation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "lotId" TEXT NOT NULL REFERENCES "StockLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "quantity" INTEGER NOT NULL CHECK ("quantity" > 0)
);
CREATE INDEX "StockAllocation_tenantId_invoiceId_idx" ON "StockAllocation"("tenantId", "invoiceId");
-- Historical receipts cannot be reconstructed reliably. Start from the current
-- on-hand quantity at the last known cost, explicitly marked as an estimate.
INSERT INTO "StockLot" ("id", "tenantId", "productId", "quantity", "remaining", "unitCost", "source")
SELECT 'legacy-' || "id", "tenantId", "id", "quantity", "quantity", "costPrice", 'LegacyOpening'
FROM "Product" WHERE "quantity" > 0;
ALTER TABLE "Product" ADD CONSTRAINT "Product_quantity_nonnegative" CHECK ("quantity" >= 0);
