import { ENV } from "../src/lib/env.js";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: ENV.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD = "password123";

const demoUsers = [
  { email: "cashier@demo.com", role: "CASHIER" as const },
  { email: "kitchen@demo.com", role: "KITCHEN" as const },
  { email: "manager@demo.com", role: "MANAGER" as const },
];

type SeedModifier = {
  id: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
};

function modifierUpsertArgs(modifier: SeedModifier, menuItemId: string) {
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

type SeedItem = {
  id: string;
  itemNumber: string | null;
  name: string;
  description: string;
  price: number;
  sortOrder: number;
  options?: SeedModifier[];
  sizes?: SeedModifier[];
};

type SeedCategory = {
  id: string;
  name: string;
  sortOrder: number;
  items: SeedItem[];
};

const demoMenu: SeedCategory[] = [
  {
    id: "appetizers",
    name: "Appetizers",
    sortOrder: 0,
    items: [
      {
        id: "garlic-bread",
        itemNumber: "A1",
        name: "Garlic Bread",
        description: "Toasted bread with garlic butter",
        price: 5.99,
        sortOrder: 0,
      },
      {
        id: "caesar-salad",
        itemNumber: "A2",
        name: "Caesar Salad",
        description: "Romaine, parmesan, croutons",
        price: 8.99,
        sortOrder: 1,
        options: [
          {
            id: "caesar-no-onions",
            name: "No onions",
            priceDelta: 0,
            sortOrder: 0,
          },
          {
            id: "caesar-extra-cheese",
            name: "Extra cheese",
            priceDelta: 1.5,
            sortOrder: 1,
          },
        ],
      },
    ],
  },
  {
    id: "soups",
    name: "Soups",
    sortOrder: 1,
    items: [
      {
        id: "tomato-soup",
        itemNumber: "S1",
        name: "Tomato Soup",
        description: "Daily soup",
        price: 6.49,
        sortOrder: 0,
      },
    ],
  },
  {
    id: "combos",
    name: "Special Combos",
    sortOrder: 2,
    items: [
      {
        id: "lunch-combo",
        itemNumber: "C1",
        name: "Lunch Combo",
        description: "Main + drink",
        price: 14.99,
        sortOrder: 0,
      },
    ],
  },
  {
    id: "sides",
    name: "Sides",
    sortOrder: 3,
    items: [
      {
        id: "fries",
        itemNumber: null,
        name: "French Fries",
        description: "Crispy fries",
        price: 3.99,
        sortOrder: 0,
      },
    ],
  },
  {
    id: "mains",
    name: "Mains",
    sortOrder: 4,
    items: [
      {
        id: "margherita-pizza",
        itemNumber: "1",
        name: "Margherita Pizza",
        description: "Tomato, mozzarella, basil",
        price: 12.99,
        sortOrder: 0,
        options: [
          {
            id: "pizza-extra-cheese",
            name: "Extra cheese",
            priceDelta: 2,
            sortOrder: 0,
          },
        ],
      },
      {
        id: "grilled-chicken",
        itemNumber: "2",
        name: "Grilled Chicken",
        description: "Served with seasonal vegetables",
        price: 15.99,
        sortOrder: 1,
        options: [
          {
            id: "chicken-extra",
            name: "Extra chicken",
            priceDelta: 3.5,
            sortOrder: 0,
          },
          {
            id: "chicken-no-veg",
            name: "No vegetables",
            priceDelta: 0,
            sortOrder: 1,
          },
        ],
      },
    ],
  },
  {
    id: "drinks",
    name: "Drinks",
    sortOrder: 5,
    items: [
      {
        id: "soft-drink",
        itemNumber: "11",
        name: "Soft Drink",
        description: "Fountain soda",
        price: 2.99,
        sortOrder: 0,
        sizes: [
          { id: "soft-drink-small", name: "Small", priceDelta: 0, sortOrder: 0 },
          { id: "soft-drink-regular", name: "Regular", priceDelta: 0, sortOrder: 1 },
          { id: "soft-drink-large", name: "Large", priceDelta: 1, sortOrder: 2 },
        ],
      },
      {
        id: "house-coffee",
        itemNumber: "12",
        name: "House Coffee",
        description: "Freshly brewed",
        price: 3.49,
        sortOrder: 1,
        sizes: [
          { id: "house-coffee-small", name: "Small", priceDelta: 0, sortOrder: 0 },
          { id: "house-coffee-large", name: "Large", priceDelta: 0.8, sortOrder: 1 },
        ],
      },
    ],
  },
  {
    id: "desserts",
    name: "Desserts",
    sortOrder: 6,
    items: [
      {
        id: "chocolate-brownie",
        itemNumber: "21",
        name: "Chocolate Brownie",
        description: "Warm brownie with ice cream",
        price: 6.99,
        sortOrder: 0,
      },
    ],
  },
];

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

  for (const category of demoMenu) {
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

      for (const option of item.options ?? []) {
        await prisma.menuItemOption.upsert({
          where: { id: option.id },
          ...modifierUpsertArgs(option, item.id),
        });
      }

      for (const size of item.sizes ?? []) {
        await prisma.menuItemSize.upsert({
          where: { id: size.id },
          ...modifierUpsertArgs(size, item.id),
        });
      }
    }
  }

  console.log(`Seeded ${demoMenu.length} categories with menu items`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
