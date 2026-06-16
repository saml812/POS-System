-- CreateEnum
CREATE TYPE "TenderType" AS ENUM ('CASH', 'CARD', 'SPLIT');

-- CreateEnum
CREATE TYPE "PaidStatus" AS ENUM ('UNPAID', 'PAID', 'REFUNDED');

-- AlterTable: add new columns
ALTER TABLE "Order"
  ADD COLUMN "tenderType" "TenderType",
  ADD COLUMN "paidStatus" "PaidStatus" NOT NULL DEFAULT 'UNPAID';

-- Migrate data from legacy payment processor fields
UPDATE "Order"
SET
  "tenderType" = "paymentMethod"::text::"TenderType",
  "paidStatus" = CASE
    WHEN "paymentStatus"::text = 'AUTHORIZED' THEN 'PAID'::"PaidStatus"
    WHEN "paymentStatus"::text = 'REFUNDED' THEN 'REFUNDED'::"PaidStatus"
    ELSE 'UNPAID'::"PaidStatus"
  END
WHERE "paymentMethod" IS NOT NULL OR "paymentStatus" IS NOT NULL;

-- Drop legacy columns
ALTER TABLE "Order"
  DROP COLUMN "paymentMethod",
  DROP COLUMN "paymentStatus",
  DROP COLUMN "paymentRefNo",
  DROP COLUMN "paymentAuthCode",
  DROP COLUMN "paymentRecordNo",
  DROP COLUMN "paymentAcqRefData",
  DROP COLUMN "paymentProcess",
  DROP COLUMN "paymentError",
  DROP COLUMN "paymentAttemptCount";

-- DropEnum
DROP TYPE "PaymentMethod";
DROP TYPE "PaymentStatus";
