import { PrismaClient } from '@prisma/client';
import { CampaignService } from '../services/CampaignService';
import { emailQueue } from '../config/queue';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function enqueueRestartTest() {
  console.log('--- Phase 6 Restart Test: ENQUEUE ---');
  let user = await prisma.user.findFirst();
  let sender = await prisma.sender.findFirst({ where: { userId: user!.id } });

  const campaignService = new CampaignService();
  const startTime = new Date(Date.now() + 20000); // 20 seconds from now
  
  console.log(`Scheduling email for 20 seconds in the future: ${startTime.toISOString()}`);
  
  const result = await campaignService.scheduleCampaign(user!.id, {
    senderId: sender!.id,
    subject: 'Phase 6 Restart Survival Test',
    body: '<p>This email should survive a process restart.</p>',
    startTime: startTime,
    recipients: ['restart-recipient@example.com'],
    delayBetweenEmails: 1000,
    hourlyLimit: 100
  } as any);

  console.log(`Campaign created: ${result.campaignId}.`);
  console.log('Exiting process now to simulate worker shutdown...');
  
  await emailQueue.close();
  await prisma.$disconnect();
  process.exit(0);
}

enqueueRestartTest();
