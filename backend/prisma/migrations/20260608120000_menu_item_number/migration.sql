-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN "itemNumber" TEXT;

-- AlterTable
ALTER TABLE "Category" DROP COLUMN IF EXISTS "itemNumberingScheme";

-- DropEnum
DROP TYPE IF EXISTS "ItemNumberingScheme";
