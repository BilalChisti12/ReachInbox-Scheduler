import { PrismaClient } from '@prisma/client';
import { emailQueue } from '../config/queue';
import { startWorker } from '../worker/EmailWorker';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function testAlreadySent() {
  console.log('--- Phase 7 Already Sent Test ---');
  
  const user = await prisma.user.findFirst();
  const sender = await prisma.sender.findFirst({ where: { userId: user!.id } });
  
  const campaign = await prisma.campaign.create({
    data: {
      userId: user!.id,
      senderId: sender!.id,
      subject: 'Already Sent Test',
      body: 'Testing already sent protection',
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
      recipient: 'already-sent@example.com',
      subject: 'Already Sent Test',
      body: 'Testing already sent protection',
      scheduledAt: new Date(),
      status: 'sent', // ALREADY SENT
      sentAt: new Date(),
      idempotencyKey: `alreadysent_${emailId}`
    }
  });

  console.log('Enqueuing BullMQ job for an already sent email...');
  await emailQueue.add('send-email', { emailId, userId: user!.id }, { jobId: `email-job-alreadysent-${emailId}` });

  console.log('Starting worker to process job...');
  const worker = startWorker();

  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const finalJob = await prisma.emailJob.findUnique({ where: { id: emailId } });

  await worker.close();
  await emailQueue.close();
  await prisma.$disconnect();
  
  if (finalJob?.status === 'sent') {
    console.log('✅ Worker safely skipped the already sent job.');
    process.exit(0);
  } else {
    console.error('❌ Failed.');
    process.exit(1);
  }
}

testAlreadySent();
