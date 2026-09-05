import { PrismaClient } from '@prisma/client';
import { EmailJobRepository } from '../repositories/EmailJobRepository';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();
const repo = new EmailJobRepository();

async function testConcurrentClaim() {
  console.log('--- Phase 7 Concurrent Claim Test ---');
  
  const user = await prisma.user.findFirst();
  const sender = await prisma.sender.findFirst({ where: { userId: user!.id } });
  
  const campaign = await prisma.campaign.create({
    data: {
      userId: user!.id,
      senderId: sender!.id,
      subject: 'Concurrent Claim Test',
      body: 'Testing',
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
      recipient: 'concurrent@example.com',
      subject: 'Concurrent Test',
      body: 'Testing',
      scheduledAt: new Date(),
      status: 'scheduled',
      idempotencyKey: `concurrent_${emailId}`
    }
  });

  console.log('Spawning two concurrent claim requests...');
  
  const results = await Promise.all([
    repo.transitionStatus(emailId, user!.id, 'scheduled', 'processing'),
    repo.transitionStatus(emailId, user!.id, 'scheduled', 'processing')
  ]);

  const successCount = results.filter(r => r !== null).length;
  const failureCount = results.filter(r => r === null).length;

  console.log(`Results: ${successCount} successful claims, ${failureCount} failed claims.`);
  
  if (successCount === 1 && failureCount === 1) {
    console.log('✅ Exactly one concurrent worker successfully claimed the job!');
    process.exit(0);
  } else {
    console.error(`❌ Idempotency failure. Expected 1 success and 1 fail, got ${successCount} and ${failureCount}`);
    process.exit(1);
  }
}

testConcurrentClaim();
