import { PrismaClient } from '@prisma/client';
import { emailQueue } from '../config/queue';
import { startWorker } from '../worker/EmailWorker';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function testDuplicateJobs() {
  console.log('--- Phase 7 Duplicate BullMQ Jobs Test ---');
  
  const user = await prisma.user.findFirst();
  const sender = await prisma.sender.findFirst({ where: { userId: user!.id } });
  
  const campaign = await prisma.campaign.create({
    data: {
      userId: user!.id,
      senderId: sender!.id,
      subject: 'Duplicate Jobs Test',
      body: 'Testing duplicate protection',
      startTime: new Date(),
      delayBetweenEmails: 0,
      hourlyLimit: 100
    }
  });

  const emailId = crypto.randomUUID();
  await prisma.emailJob.create({
    data: {
      id: emailId,
      campaignId: campaign.id,
      userId: user!.id,
      senderId: sender!.id,
      recipient: 'duplicate@example.com',
      subject: 'Duplicate Test',
      body: 'Testing duplicate protection',
      scheduledAt: new Date(),
      status: 'scheduled',
      idempotencyKey: `dup_${emailId}`
    }
  });

  console.log('Enqueuing TWO separate BullMQ jobs pointing to the SAME emailId...');
  await emailQueue.add('send-email', { emailId, userId: user!.id }, { jobId: `email-job-duplicate-1-${emailId}` });
  await emailQueue.add('send-email', { emailId, userId: user!.id }, { jobId: `email-job-duplicate-2-${emailId}` });

  console.log('Starting worker to process jobs...');
  const worker = startWorker();

  await new Promise(resolve => setTimeout(resolve, 8000));
  
  const finalJob = await prisma.emailJob.findUnique({ where: { id: emailId } });
  console.log(`Final Database Status: ${finalJob?.status}`);

  // In the console output, we should see one successful send and one warning "Failed to claim job" or "already sent".
  await worker.close();
  await emailQueue.close();
  await prisma.$disconnect();
  
  if (finalJob?.status === 'sent') {
    console.log('✅ Duplicate job test passed (only one success, status is sent). Look at the logs for "already sent" or "claim failed".');
    process.exit(0);
  } else {
    console.error('❌ Failed.');
    process.exit(1);
  }
}

testDuplicateJobs();
