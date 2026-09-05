import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Pinging database...");
    const result = await prisma.$queryRaw`SELECT 1 as result`;
    console.log("Ping successful:", result);

    console.log("Fetching stats...");
    const stats = await prisma.emailJob.groupBy({
      by: ['status'],
      _count: true,
    });
    console.log("Stats:", stats);

  } catch (err) {
    console.error("Prisma error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
