-- CreateTable
CREATE TABLE "MenuItemSize" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceDelta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItemSize_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuItemSize_menuItemId_isAvailable_sortOrder_idx" ON "MenuItemSize"("menuItemId", "isAvailable", "sortOrder");

-- AddForeignKey
ALTER TABLE "MenuItemSize" ADD CONSTRAINT "MenuItemSize_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "sizeName" TEXT;
