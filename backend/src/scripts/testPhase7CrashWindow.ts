import { PrismaClient } from '@prisma/client';
import { emailQueue } from '../config/queue';
import { startWorker } from '../worker/EmailWorker';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function testCrashWindow() {
  console.log('--- Phase 7 Crash Window Protection Test ---');
  
  const user = await prisma.user.findFirst();
  const sender = await prisma.sender.findFirst({ where: { userId: user!.id } });
  
  const campaign = await prisma.campaign.create({
    data: {
      userId: user!.id,
      senderId: sender!.id,
      subject: 'Crash Window Test',
      body: 'Testing crash window protection',
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
      recipient: 'crash-window@example.com',
      subject: 'Crash Window Test',
      body: 'Testing crash window protection',
      scheduledAt: new Date(),
      status: 'processing', // STUCK IN PROCESSING
      idempotencyKey: `crashwindow_${emailId}`
    }
  });

  console.log('Enqueuing BullMQ job for an email stuck in processing...');
  await emailQueue.add('send-email', { emailId, userId: user!.id }, { jobId: `email-job-crashwindow-${emailId}` });

  console.log('Starting worker to process job...');
  const worker = startWorker();

  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const finalJob = await prisma.emailJob.findUnique({ where: { id: emailId } });
  
  await worker.close();
  await emailQueue.close();
  await prisma.$disconnect();
  
  if (finalJob?.status === 'failed' && finalJob.failureReason?.includes('worker crash protection')) {
    console.log('✅ Worker safely aborted the processing job and marked it as failed (At-Most-Once protection).');
    process.exit(0);
  } else {
    console.error(`❌ Failed. Expected status 'failed' with crash reason, got '${finalJob?.status}'.`);
    process.exit(1);
  }
}

testCrashWindow();
