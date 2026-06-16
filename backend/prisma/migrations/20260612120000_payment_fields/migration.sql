-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'SPLIT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PROCESSING', 'AUTHORIZED', 'FAILED', 'VOIDED', 'REFUNDED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "payAtPickup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "cardAmount" DECIMAL(10,2),
ADD COLUMN     "cashAmount" DECIMAL(10,2),
ADD COLUMN     "paymentRefNo" TEXT,
ADD COLUMN     "paymentAuthCode" TEXT,
ADD COLUMN     "paymentRecordNo" TEXT,
ADD COLUMN     "paymentAcqRefData" TEXT,
ADD COLUMN     "paymentProcess" TEXT,
ADD COLUMN     "paymentError" TEXT,
ADD COLUMN     "paymentAttemptCount" INTEGER NOT NULL DEFAULT 0;
