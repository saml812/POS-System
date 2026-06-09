-- AlterTable
ALTER TABLE "Order" ADD COLUMN "businessDate" TEXT;

-- Backfill existing orders using their created date (UTC calendar day)
UPDATE "Order"
SET "businessDate" = to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
WHERE "businessDate" IS NULL;

ALTER TABLE "Order" ALTER COLUMN "businessDate" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Order_businessDate_status_createdAt_idx" ON "Order"("businessDate", "status", "createdAt");
