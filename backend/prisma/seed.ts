import { ENV } from "../src/lib/env";
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

const demoMenu = [
  {
    id: "appetizers",
    name: "Appetizers",
    sortOrder: 0,
    items: [
      {
        id: "garlic-bread",
        name: "Garlic Bread",
        description: "Toasted bread with garlic butter",
        price: 5.99,
        sortOrder: 0,
      },
      {
        id: "caesar-salad",
        name: "Caesar Salad",
        description: "Romaine, parmesan, croutons",
        price: 8.99,
        sortOrder: 1,
      },
    ],
  },
  {
    id: "mains",
    name: "Mains",
    sortOrder: 1,
    items: [
      {
        id: "margherita-pizza",
        name: "Margherita Pizza",
        description: "Tomato, mozzarella, basil",
        price: 12.99,
        sortOrder: 0,
      },
      {
        id: "grilled-chicken",
        name: "Grilled Chicken",
        description: "Served with seasonal vegetables",
        price: 15.99,
        sortOrder: 1,
      },
    ],
  },
  {
    id: "drinks",
    name: "Drinks",
    sortOrder: 2,
    items: [
      {
        id: "soft-drink",
        name: "Soft Drink",
        description: "330ml can",
        price: 2.99,
        sortOrder: 0,
      },
      {
        id: "house-coffee",
        name: "House Coffee",
        description: "Freshly brewed",
        price: 3.49,
        sortOrder: 1,
      },
    ],
  },
  {
    id: "desserts",
    name: "Desserts",
    sortOrder: 3,
    items: [
      {
        id: "chocolate-brownie",
        name: "Chocolate Brownie",
        description: "Warm brownie with ice cream",
        price: 6.99,
        sortOrder: 0,
      },
    ],
  },
];

async function main() {
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12);

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
          description: item.description,
          price: item.price,
          sortOrder: item.sortOrder,
          categoryId: createdCategory.id,
        },
        create: {
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          sortOrder: item.sortOrder,
          categoryId: createdCategory.id,
        },
      });
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
