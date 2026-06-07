import "dotenv/config";
import { prisma } from "../src/lib/db.js";

try {
  const count = await prisma.user.count();
  console.log(`Connected (${count} user(s) in database)`);
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
