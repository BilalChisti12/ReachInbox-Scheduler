import { PrismaClient } from '@prisma/client';
import { startWorker } from '../worker/EmailWorker';
import { emailQueue } from '../config/queue';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function verifyRestartTest() {
  console.log('--- Phase 6 Restart Test: VERIFY ---');
  
  console.log('Starting worker to process surviving jobs...');
  const worker = startWorker();
  
  console.log('Waiting 25 seconds for the job to trigger and process...');
  let elapsed = 0;
  const interval = setInterval(() => {
    elapsed += 5;
    console.log(`... ${elapsed} seconds elapsed ...`);
  }, 5000);

  await new Promise(resolve => setTimeout(resolve, 25000));
  clearInterval(interval);
  
  console.log('Checking database state...');
  const emails = await prisma.emailJob.findMany({
    where: { recipient: 'restart-recipient@example.com' },
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  
  let success = false;
  if (emails.length === 1 && emails[0].status === 'sent') {
    console.log('✅ Restart-survival email successfully processed by the reconnected worker!');
    console.log(`   SentAt: ${emails[0].sentAt}`);
    success = true;
  } else {
    console.error('❌ Email status not updated correctly.', emails[0]);
  }
  
  await worker.close();
  await emailQueue.close();
  await prisma.$disconnect();
  
  if (!success) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

verifyRestartTest();
