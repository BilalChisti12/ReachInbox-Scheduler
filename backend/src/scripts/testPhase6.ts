import { PrismaClient } from '@prisma/client';
import { CampaignService } from '../services/CampaignService';
import { emailQueue } from '../config/queue';
import { startWorker } from '../worker/EmailWorker';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function testPhase6() {
  console.log('--- Phase 6 Live Integration Test ---');
  
  // 1. Setup DB prerequisites
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: 'test-google-id-phase6',
        email: 'test-phase6@example.com',
        name: 'Phase 6 Tester'
      }
    });
  }

  // Always create a fresh sender with current env credentials to avoid stale SMTP auth
  const sender = await prisma.sender.create({
    data: {
      userId: user.id,
      email: process.env.ETHEREAL_USER || 'jackie.effertz64@ethereal.email',
      displayName: 'Phase 6 Fresh Sender',
      smtpHost: process.env.ETHEREAL_HOST || 'smtp.ethereal.email',
      smtpPort: Number(process.env.ETHEREAL_PORT) || 587,
      smtpUsername: process.env.ETHEREAL_USER || 'jackie.effertz64@ethereal.email',
      smtpPassword: process.env.ETHEREAL_PASSWORD || 'PTKXWxJ68WUu9yf5KD',
    }
  });

  // 2. Start the worker locally in the test script
  const worker = startWorker();
  
  // 3. Wait a moment for worker and queue to connect
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 4. Schedule a campaign 10 seconds into the future
  const campaignService = new CampaignService();
  const startTime = new Date(Date.now() + 10000); // 10 seconds from now
  
  console.log(`Scheduling email for 10 seconds in the future: ${startTime.toISOString()}`);
  
  const result = await campaignService.scheduleCampaign(user.id, {
    senderId: sender.id,
    subject: 'Phase 6 Delayed Email Test',
    body: '<p>This email should arrive about 10 seconds after scheduling.</p>',
    startTime: startTime,
    recipients: ['test-recipient@example.com'],
    delayBetweenEmails: 1000,
    hourlyLimit: 100
  } as any);

  console.log(`Campaign created: ${result.campaignId}. Jobs: ${result.jobsCreated}`);
  
  console.log('Waiting up to 30 seconds for job to be processed by BullMQ and sent via Ethereal...');
  let success = false;
  let sentEmail = null;
  
  for (let i = 0; i < 15; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(`... ${i * 2 + 2} seconds elapsed ...`);
    
    const emails = await prisma.emailJob.findMany({
      where: { campaignId: result.campaignId }
    });
    
    if (emails.length === 1 && emails[0].status === 'sent') {
      success = true;
      sentEmail = emails[0];
      break;
    }
  }
  
  if (success && sentEmail) {
    console.log('✅ Email successfully processed and status updated to SENT!');
    console.log(`   SentAt: ${sentEmail.sentAt}`);
  } else {
    const finalEmails = await prisma.emailJob.findMany({ where: { campaignId: result.campaignId }});
    console.error('❌ Email status not updated to sent within timeout.', finalEmails[0]);
  }
  
  await worker.close();
  await emailQueue.close();
  await prisma.$disconnect();
  
  if (!success) {
    process.exit(1);
  } else {
    console.log('\n✅ Phase 6 verification passed.');
    process.exit(0);
  }
}

testPhase6();
