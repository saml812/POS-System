import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
});

async function connectDB() {
  try {
    await prisma.$connect();
    console.log("Database connected")
  } catch (error) {
    console.log(`Database connection error: ${error.message}`)
    process.exit(1);
  }
}

async function disconnectDB() {
  await prisma.$disconnect();
}

export { prisma, connectDB, disconnectDB };