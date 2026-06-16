-- AlterTable
ALTER TABLE "Order"
  ADD COLUMN "refundTenderType" "TenderType",
  ADD COLUMN "refundedCardAmount" DECIMAL(10,2),
  ADD COLUMN "refundedCashAmount" DECIMAL(10,2),
  ADD COLUMN "refundedAt" TIMESTAMP(3),
  ADD COLUMN "refundedById" TEXT;

-- AddForeignKey
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_refundedById_fkey"
  FOREIGN KEY ("refundedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
