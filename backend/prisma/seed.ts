import { ENV } from "../src/lib/env.js";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { Menu, type SeedModifier } from "./menu-seed-data.js";

const adapter = new PrismaPg({
  connectionString: ENV.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD = "password123";

const demoUsers = [
  { email: "cashier@demo.com", role: "CASHIER" as const },
  { email: "kitchen@demo.com", role: "KITCHEN" as const },
  { email: "manager1@demo.com", role: "MANAGER" as const },
  { email: "manager2@demo.com", role: "MANAGER" as const },
];

function optionUpsertArgs(modifier: SeedModifier, menuItemId: string) {
  return {
    update: {
      name: modifier.name,
      priceDelta: modifier.priceDelta,
      sortOrder: modifier.sortOrder,
      optionGroup: modifier.group ?? null,
      menuItemId,
    },
    create: {
      id: modifier.id,
      name: modifier.name,
      priceDelta: modifier.priceDelta,
      sortOrder: modifier.sortOrder,
      optionGroup: modifier.group ?? null,
      menuItemId,
    },
  };
}

function sizeUpsertArgs(modifier: SeedModifier, menuItemId: string) {
  return {
    update: {
      name: modifier.name,
      priceDelta: modifier.priceDelta,
      sortOrder: modifier.sortOrder,
      menuItemId,
    },
    create: {
      id: modifier.id,
      name: modifier.name,
      priceDelta: modifier.priceDelta,
      sortOrder: modifier.sortOrder,
      menuItemId,
    },
  };
}

const defaultAppSettings = [
  { key: "ticket_reset.timezone", value: "local" },
  { key: "ticket_reset.hour", value: "0" },
];

async function main() {
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12);

  for (const setting of defaultAppSettings) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  for (const { email, role } of demoUsers) {
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password: hashedPassword,
        role,
      },
    });
  }

  console.log("Seeded demo users:");
  for (const { email, role } of demoUsers) {
    console.log(`  ${email} (${role})`);
  }

  let itemCount = 0;

  for (const category of Menu) {
    const createdCategory = await prisma.category.upsert({
      where: { id: category.id },
      update: {
        name: category.name,
        sortOrder: category.sortOrder,
      },
      create: {
        id: category.id,
        name: category.name,
        sortOrder: category.sortOrder,
      },
    });

    for (const item of category.items) {
      itemCount += 1;

      await prisma.menuItem.upsert({
        where: { id: item.id },
        update: {
          name: item.name,
          itemNumber: item.itemNumber,
          description: item.description,
          price: item.price,
          sortOrder: item.sortOrder,
          categoryId: createdCategory.id,
        },
        create: {
          id: item.id,
          name: item.name,
          itemNumber: item.itemNumber,
          description: item.description,
          price: item.price,
          sortOrder: item.sortOrder,
          categoryId: createdCategory.id,
        },
      });

      const optionIds = (item.options ?? []).map((option) => option.id);
      await prisma.menuItemOption.deleteMany({
        where: {
          menuItemId: item.id,
          ...(optionIds.length > 0 ? { id: { notIn: optionIds } } : {}),
        },
      });

      for (const option of item.options ?? []) {
        await prisma.menuItemOption.upsert({
          where: { id: option.id },
          ...optionUpsertArgs(option, item.id),
        });
      }

      const sizeIds = (item.sizes ?? []).map((size) => size.id);
      await prisma.menuItemSize.deleteMany({
        where: {
          menuItemId: item.id,
          ...(sizeIds.length > 0 ? { id: { notIn: sizeIds } } : {}),
        },
      });

      for (const size of item.sizes ?? []) {
        await prisma.menuItemSize.upsert({
          where: { id: size.id },
          ...sizeUpsertArgs(size, item.id),
        });
      }
    }
  }

  console.log(
    `Seeded ${Menu.length} categories with ${itemCount} menu items`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
