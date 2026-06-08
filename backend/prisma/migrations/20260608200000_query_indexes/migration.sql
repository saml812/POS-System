-- DropIndex
DROP INDEX IF EXISTS "MenuItem_categoryId_idx";

-- DropIndex
DROP INDEX IF EXISTS "Order_status_idx";

-- DropIndex
DROP INDEX IF EXISTS "Order_createdAt_idx";

-- CreateIndex
CREATE INDEX "Category_isActive_sortOrder_idx" ON "Category"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_isAvailable_sortOrder_idx" ON "MenuItem"("categoryId", "isAvailable", "sortOrder");

-- CreateIndex
CREATE INDEX "MenuItemOption_menuItemId_isAvailable_sortOrder_idx" ON "MenuItemOption"("menuItemId", "isAvailable", "sortOrder");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
