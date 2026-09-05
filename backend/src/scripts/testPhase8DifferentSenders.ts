import { PrismaClient } from '@prisma/client';
import { CampaignService } from '../services/CampaignService';
import { emailQueue, redisConnection } from '../config/queue';
import { startWorker } from '../worker/EmailWorker';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function run() {
  console.log('--- Phase 8 Different Senders Limit Test ---');
  
  // Set global limit to 3 per hour
  process.env.MAX_EMAILS_PER_HOUR = '3';
  process.env.MIN_EMAIL_DELAY_MS = '0'; // Process immediately

  // 1. Setup Test User and Senders
  const user = await prisma.user.create({
    data: {
      googleId: crypto.randomUUID(),
      email: `test-p8-${Date.now()}@example.com`,
      name: 'Phase 8 Test User'
    }
  });

  const senderA = await prisma.sender.create({
    data: {
      userId: user.id,
      email: process.env.ETHEREAL_USER || 'p8-sender-A@example.com',
      smtpHost: process.env.ETHEREAL_HOST || 'smtp.ethereal.email',
      smtpPort: Number(process.env.ETHEREAL_PORT) || 587,
      smtpUsername: process.env.ETHEREAL_USER || 'testA',
      smtpPassword: process.env.ETHEREAL_PASSWORD || 'testA'
    }
  });

  const senderB = await prisma.sender.create({
    data: {
      userId: user.id,
      email: process.env.ETHEREAL_USER || 'p8-sender-B@example.com',
      smtpHost: process.env.ETHEREAL_HOST || 'smtp.ethereal.email',
      smtpPort: Number(process.env.ETHEREAL_PORT) || 587,
      smtpUsername: process.env.ETHEREAL_USER || 'testB',
      smtpPassword: process.env.ETHEREAL_PASSWORD || 'testB'
    }
  });

  const campaignService = new CampaignService();

  console.log('Scheduling 3 emails for Sender A and 3 for Sender B...');
  
  const resultA = await campaignService.scheduleCampaign(user.id, {
    senderId: senderA.id,
    subject: 'Phase 8 Test A',
    body: 'Testing Rate Limiting A',
    startTime: new Date(),
    delayBetweenEmails: 0,
    hourlyLimit: 10,
    recipients: ['a1@example.com', 'a2@example.com', 'a3@example.com']
  });

  const resultB = await campaignService.scheduleCampaign(user.id, {
    senderId: senderB.id,
    subject: 'Phase 8 Test B',
    body: 'Testing Rate Limiting B',
    startTime: new Date(),
    delayBetweenEmails: 0,
    hourlyLimit: 10,
    recipients: ['b1@example.com', 'b2@example.com', 'b3@example.com']
  });

  const worker = startWorker();

  console.log('Waiting 15 seconds for processing...');
  
  await new Promise(resolve => setTimeout(resolve, 15000));

  await worker.close();

  // Verify DB State
  const sentJobsA = await prisma.emailJob.count({
    where: { campaignId: resultA.campaignId, status: 'sent' }
  });
  const sentJobsB = await prisma.emailJob.count({
    where: { campaignId: resultB.campaignId, status: 'sent' }
  });

  console.log(`Sender A -> Sent: ${sentJobsA} (Expected 3)`);
  console.log(`Sender B -> Sent: ${sentJobsB} (Expected 3)`);

  // Clean up
  await prisma.user.delete({ where: { id: user.id } });
  
  const keys = await redisConnection.keys('rate:*');
  if (keys.length > 0) {
    await redisConnection.del(...keys);
  }

  if (sentJobsA === 3 && sentJobsB === 3) {
    console.log('✅ Different senders rate limit enforced correctly (independently)!');
    process.exit(0);
  } else {
    console.error(`❌ Failed! Expected both to send 3.`);
    process.exit(1);
  }
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
