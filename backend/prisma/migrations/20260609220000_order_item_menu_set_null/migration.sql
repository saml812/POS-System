-- Allow deleting menu items; order line snapshots (name, price, etc.) are kept.
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_menuItemId_fkey";

ALTER TABLE "OrderItem" ALTER COLUMN "menuItemId" DROP NOT NULL;

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey"
FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
