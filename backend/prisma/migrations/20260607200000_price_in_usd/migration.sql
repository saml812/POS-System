-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN "price" DECIMAL(10,2);

UPDATE "MenuItem" SET "price" = "priceCents" / 100.0;

ALTER TABLE "MenuItem" ALTER COLUMN "price" SET NOT NULL;

ALTER TABLE "MenuItem" DROP COLUMN "priceCents";
