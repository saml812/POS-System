-- CreateEnum
CREATE TYPE "ItemNumberingScheme" AS ENUM ('NONE', 'PREFIX_A', 'PREFIX_C', 'PREFIX_S', 'GLOBAL');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "itemNumberingScheme" "ItemNumberingScheme" NOT NULL DEFAULT 'GLOBAL';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "ticketNumber" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "itemCode" TEXT;

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Order_ticketNumber_idx" ON "Order"("ticketNumber");
