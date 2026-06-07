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
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
