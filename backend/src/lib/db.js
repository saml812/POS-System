import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.ts";
import { ENV } from "./env.js";

const adapter = new PrismaPg({
  connectionString: ENV.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
  log:
    ENV.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
});

async function connectDB() {
  try {
    await prisma.$connect();
    console.log("Database connected");
  } catch (error) {
    console.log(`Database connection error: ${error.message}`);
    process.exit(1);
  }
}

async function disconnectDB() {
  await prisma.$disconnect();
}

export { prisma, connectDB, disconnectDB };
