import { PrismaClient } from '@prisma/client';
import { CampaignService } from '../services/CampaignService';
import { emailQueue, redisConnection } from '../config/queue';
import { startWorker } from '../worker/EmailWorker';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function run() {
  console.log('--- Phase 8 Single Sender Limit Test ---');
  
  // Set global limit to 3 per hour
  process.env.MAX_EMAILS_PER_HOUR = '3';
  process.env.MIN_EMAIL_DELAY_MS = '0'; // Process immediately
  process.env.WORKER_CONCURRENCY = '1'; // Sequential processing for deterministic rate limit test

  // Clear any existing rate limit keys from previous test runs to ensure isolation
  const existingRateKeys = await redisConnection.keys('rate:*');
  if (existingRateKeys.length > 0) {
    await redisConnection.del(...existingRateKeys);
  }

  // 1. Setup Test User and Sender
  const user = await prisma.user.create({
    data: {
      googleId: crypto.randomUUID(),
      email: `test-p8-${Date.now()}@example.com`,
      name: 'Phase 8 Test User'
    }
  });

  const sender = await prisma.sender.create({
    data: {
      userId: user.id,
      displayName: 'Phase 8 Sender',
      email: process.env.ETHEREAL_USER || 'p8-sender@example.com',
      smtpHost: process.env.ETHEREAL_HOST || 'smtp.ethereal.email',
      smtpPort: Number(process.env.ETHEREAL_PORT) || 587,
      smtpUsername: process.env.ETHEREAL_USER || 'test',
      smtpPassword: process.env.ETHEREAL_PASSWORD || 'test'
    }
  });

  const campaignService = new CampaignService();

  console.log('Scheduling 5 emails for a sender with a limit of 3/hour...');
  
  const result = await campaignService.scheduleCampaign(user.id, {
    senderId: sender.id,
    subject: 'Phase 8 Test',
    body: 'Testing Rate Limiting',
    startTime: new Date(),
    delayBetweenEmails: 0,
    hourlyLimit: 10, // campaign limit is 10, but global sender limit is 3!
    recipients: [
      '1@example.com', '2@example.com', '3@example.com', '4@example.com', '5@example.com'
    ]
  });

  console.log(`Campaign created: ${result.campaignId}. Jobs: ${result.jobsCreated}`);

  const worker = startWorker();

  console.log('Waiting 15 seconds for processing...');
  
  await new Promise(resolve => setTimeout(resolve, 15000));

  await worker.close();

  // Verify DB State
  const sentJobs = await prisma.emailJob.count({
    where: { campaignId: result.campaignId, status: 'sent' }
  });

  const scheduledJobs = await prisma.emailJob.count({
    where: { campaignId: result.campaignId, status: 'scheduled' }
  });

  console.log(`Sent Jobs: ${sentJobs}`);
  console.log(`Scheduled (Delayed) Jobs: ${scheduledJobs}`);

  // Clean up
  await prisma.user.delete({ where: { id: user.id } });
  
  // Clear redis rate limit keys
  const keys = await redisConnection.keys('rate:*');
  if (keys.length > 0) {
    await redisConnection.del(...keys);
  }

  if (sentJobs === 3 && scheduledJobs === 2) {
    console.log('✅ Single sender rate limit enforced correctly!');
    process.exit(0);
  } else {
    console.error('❌ Failed! Expected 3 sent and 2 delayed.');
    process.exit(1);
  }
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
