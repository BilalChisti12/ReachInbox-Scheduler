
const { PrismaClient } = require("@prisma/client");
const { Queue } = require("bullmq");
const dotenv = require("dotenv");
dotenv.config();

const p = new PrismaClient();

const queue = new Queue("email-scheduler", {
  connection: { url: process.env.REDIS_URL }
});

async function requeue() {
  const jobs = await p.emailJob.findMany({ where: { status: "scheduled" } });
  console.log(`Re-enqueuing ${jobs.length} jobs...`);
  
  for (const job of jobs) {
    const delay = Math.max(5000, job.scheduledAt.getTime() - Date.now());
    await queue.add("send-email", 
      { emailId: job.id, userId: job.userId },
      {
        delay,
        jobId: `email-job-${job.id}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 }
      }
    );
    console.log(`Enqueued job ${job.id} with delay ${delay}ms`);
  }

  console.log("Done!");
  await queue.close();
}

requeue().catch(console.error).finally(() => p.$disconnect());

