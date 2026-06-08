-- AlterTable
ALTER TABLE "Category" ADD COLUMN "nameZh" TEXT;

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN "nameZh" TEXT;
ALTER TABLE "MenuItem" ADD COLUMN "descriptionZh" TEXT;

-- AlterTable
ALTER TABLE "MenuItemOption" ADD COLUMN "nameZh" TEXT;
