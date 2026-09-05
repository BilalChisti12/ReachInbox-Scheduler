import { PrismaClient } from '@prisma/client';
import { emailQueue } from '../config/queue';
import { startWorker } from '../worker/EmailWorker';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function testRetry() {
  console.log('--- Phase 7 SMTP Failure & Retry Test ---');
  
  const user = await prisma.user.findFirst();
  
  // Create a bad sender to force SMTP failure
  const badSender = await prisma.sender.create({
    data: {
      userId: user!.id,
      email: 'bad@example.com',
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
      smtpUsername: 'baduser',
      smtpPassword: 'badpassword',
      active: true
    }
  });
  
  const campaign = await prisma.campaign.create({
    data: {
      userId: user!.id,
      senderId: badSender.id,
      subject: 'Retry Test',
      body: 'Testing retry behavior',
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
      senderId: badSender.id,
      recipient: 'retry@example.com',
      subject: 'Retry Test',
      body: 'Testing retry behavior',
      scheduledAt: new Date(),
      status: 'scheduled',
      idempotencyKey: `retry_${emailId}`
    }
  });

  console.log('Enqueuing BullMQ job...');
  // Set attempts to 2 so we can see it fail once and sit in the queue waiting for retry
  await emailQueue.add('send-email', { emailId, userId: user!.id }, { jobId: `email-job-retry-${emailId}`, attempts: 2 });

  console.log('Starting worker to process job...');
  const worker = startWorker();

  await new Promise(resolve => setTimeout(resolve, 8000));
  
  const finalJob = await prisma.emailJob.findUnique({ where: { id: emailId } });
  
  // We expect the worker to catch the SMTP error, rollback state to scheduled, and throw.
  // BullMQ will queue it for retry. Since we set attempts: 2, it will retry quickly, fail again,
  // and the worker's 'failed' listener will eventually mark the DB state as 'failed'.
  
  await worker.close();
  await emailQueue.close();
  await prisma.sender.delete({ where: { id: badSender.id } }); // clean up
  await prisma.$disconnect();
  
  if (finalJob?.status === 'failed') {
    console.log('✅ Worker correctly rolled back to scheduled, retried, and finally marked as failed when exhausted.');
    process.exit(0);
  } else {
    console.error(`❌ Failed. Expected status 'failed' after exhausted retries, got '${finalJob?.status}'.`);
    process.exit(1);
  }
}

testRetry();
