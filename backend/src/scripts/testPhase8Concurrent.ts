import { PrismaClient } from '@prisma/client';
import { CampaignService } from '../services/CampaignService';
import { emailQueue, redisConnection } from '../config/queue';
import { startWorker } from '../worker/EmailWorker';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function run() {
  console.log('--- Phase 8 Concurrent Workers Limit Test ---');
  
  // Set global limit to 4 per hour
  process.env.MAX_EMAILS_PER_HOUR = '4';
  process.env.MIN_EMAIL_DELAY_MS = '0'; // Process immediately

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
      email: process.env.ETHEREAL_USER || 'p8-sender-concurrent@example.com',
      smtpHost: process.env.ETHEREAL_HOST || 'smtp.ethereal.email',
      smtpPort: Number(process.env.ETHEREAL_PORT) || 587,
      smtpUsername: process.env.ETHEREAL_USER || 'test',
      smtpPassword: process.env.ETHEREAL_PASSWORD || 'test'
    }
  });

  const campaignService = new CampaignService();

  console.log('Scheduling 10 emails...');
  
  const result = await campaignService.scheduleCampaign(user.id, {
    senderId: sender.id,
    subject: 'Phase 8 Concurrent Test',
    body: 'Testing Rate Limiting Concurrency',
    startTime: new Date(),
    delayBetweenEmails: 0,
    hourlyLimit: 10, // Not the bottleneck
    recipients: Array.from({ length: 10 }).map((_, i) => `c${i}@example.com`)
  });

  // Start 5 workers concurrently to hammer the rate limit
  console.log('Starting 5 concurrent workers...');
  const workers = Array.from({ length: 5 }).map(() => startWorker());

  console.log('Waiting 15 seconds for processing...');
  
  await new Promise(resolve => setTimeout(resolve, 15000));

  for (const w of workers) {
    await w.close();
  }

  // Verify DB State
  const sentJobs = await prisma.emailJob.count({
    where: { campaignId: result.campaignId, status: 'sent' }
  });
  const scheduledJobs = await prisma.emailJob.count({
    where: { campaignId: result.campaignId, status: 'scheduled' }
  });

  console.log(`Total Sent: ${sentJobs} (Expected 4)`);
  console.log(`Total Delayed: ${scheduledJobs} (Expected 6)`);

  // Clean up
  await prisma.user.delete({ where: { id: user.id } });
  
  const keys = await redisConnection.keys('rate:*');
  if (keys.length > 0) {
    await redisConnection.del(...keys);
  }

  if (sentJobs === 4 && scheduledJobs === 6) {
    console.log('✅ Concurrent rate limit enforced correctly without race conditions!');
    process.exit(0);
  } else {
    console.error(`❌ Failed! Expected 4 sent and 6 delayed.`);
    process.exit(1);
  }
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
