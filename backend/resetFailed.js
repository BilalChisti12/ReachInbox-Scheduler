
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function resetFailed() {
  const result = await p.emailJob.updateMany({
    where: { status: "failed" },
    data: { 
      status: "scheduled",
      failureReason: null,
      scheduledAt: new Date(Date.now() + 10000) // 10 seconds from now
    }
  });
  console.log(`Reset ${result.count} failed jobs back to scheduled.`);
}

resetFailed().catch(console.error).finally(() => p.$disconnect());

