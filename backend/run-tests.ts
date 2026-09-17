import { PrismaClient } from '@prisma/client';
import { CampaignService } from './src/services/CampaignService';

const p = new PrismaClient();
const s = new CampaignService();

async function runTests() {
  const u = await p.user.findFirst();
  let sender = await p.sender.findFirst({ where: { userId: u.id, active: true } });

  if (!sender) {
    console.log("No active sender found. Creating a mock sender...");
    sender = await p.sender.create({
      data: {
        userId: u.id,
        email: 'test@example.com',
        displayName: 'Test Sender',
        smtpHost: 'smtp.ethereal.email',
        smtpPort: 587,
        smtpUsername: 'test',
        smtpPassword: 'test',
        active: true
      }
    });
  }

  console.log("Test 13: Scheduling Calculation (3 emails, 2s delay)");
  const startTime = new Date(Date.now() + 5000); // 5 sec from now
  const res = await s.scheduleCampaign(u.id, {
    subject: 'Test 13-18 Automated',
    body: 'Automated test body',
    senderId: sender.id,
    recipients: ['test1@example.com', 'test2@example.com', 'test3@example.com'],
    startTime,
    delayBetweenEmails: 2000, // 2s
    hourlyLimit: 100
  });

  console.log("Campaign scheduled. Fetching DB jobs...");
  const jobs = await p.emailJob.findMany({ where: { campaignId: res.campaignId }, orderBy: { scheduledAt: 'asc' } });
  
  jobs.forEach((job, i) => {
    console.log(`Email ${i + 1}: DB scheduledAt = ${job.scheduledAt.toISOString()}`);
  });

  console.log("Wait 15s to allow worker to process...");
  await new Promise(r => setTimeout(r, 15000));

  const postJobs = await p.emailJob.findMany({ where: { campaignId: res.campaignId }, orderBy: { scheduledAt: 'asc' } });
  postJobs.forEach((job, i) => {
    console.log(`Email ${i + 1}: Status = ${job.status}, SentAt = ${job.sentAt?.toISOString()}`);
  });

  process.exit(0);
}

runTests();
