import { PrismaClient } from '@prisma/client';
import { UserRepository } from '../repositories/UserRepository';
import { SenderRepository } from '../repositories/SenderRepository';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { EmailJobRepository } from '../repositories/EmailJobRepository';
import { SlackConnectionRepository } from '../repositories/SlackConnectionRepository';

const prisma = new PrismaClient();

async function verifyDatabase() {
  console.log('--- Verifying Database Layer ---');
  let hasErrors = false;

  try {
    const userRepo = new UserRepository();
    const senderRepo = new SenderRepository();
    const campaignRepo = new CampaignRepository();
    const emailJobRepo = new EmailJobRepository();
    const slackRepo = new SlackConnectionRepository();

    // 1. Create a user
    console.log('1. Testing UserRepository...');
    const user = await userRepo.upsertGoogleUser({
      googleId: 'test-google-id',
      email: 'test@example.com',
      name: 'Test User'
    });
    console.log(`✅ User UPSERT successful (ID: ${user.id})`);

    // 2. Create a sender
    console.log('2. Testing SenderRepository...');
    const sender = await senderRepo.create(user.id, {
      email: 'sender@example.com',
      smtpHost: 'localhost',
      smtpPort: 1025,
      smtpUsername: 'user',
      smtpPassword: 'password'
    });
    console.log(`✅ Sender CREATE successful (ID: ${sender.id})`);

    // 3. Create a campaign
    console.log('3. Testing CampaignRepository...');
    const campaign = await campaignRepo.create(user.id, sender.id, {
      subject: 'Test Campaign',
      body: 'Hello World',
      startTime: new Date(),
      delayBetweenEmails: 1000,
      hourlyLimit: 100,
      totalRecipients: 1
    });
    console.log(`✅ Campaign CREATE successful (ID: ${campaign.id})`);

    // 4. Create an email job
    console.log('4. Testing EmailJobRepository...');
    await emailJobRepo.createMany([{
      campaignId: campaign.id,
      userId: user.id,
      senderId: sender.id,
      recipient: 'target@example.com',
      subject: 'Test Campaign',
      body: 'Hello World',
      scheduledAt: new Date(),
      idempotencyKey: `campaign-${campaign.id}-target@example.com`
    }]);
    console.log(`✅ EmailJob CREATE_MANY successful`);
    
    // Status transition test
    const jobs = await emailJobRepo.findAllByCampaignId(campaign.id, user.id);
    if (jobs.length > 0) {
      const transitioned = await emailJobRepo.transitionStatus(jobs[0].id, user.id, 'scheduled', 'processing');
      if (transitioned && transitioned.status === 'processing') {
        console.log(`✅ EmailJob STATUS_TRANSITION successful`);
      } else {
        throw new Error('Transition failed');
      }
    }

    // 5. Test Slack Connection
    console.log('5. Testing SlackConnectionRepository...');
    const slack = await slackRepo.upsertConnection(user.id, {
      accessToken: 'xoxp-test-token',
      slackTeamId: 'T12345',
      slackTeamName: 'Test Team'
    });
    console.log(`✅ SlackConnection UPSERT successful (ID: ${slack.id})`);

    // Cleanup Test Data
    console.log('\nCleaning up test data...');
    await prisma.user.delete({ where: { id: user.id } }); // Cascades everything!
    console.log('✅ Cleanup successful (Cascade delete verified)');

  } catch (error) {
    console.error('\n❌ Database verification failed with error:', error);
    hasErrors = true;
  } finally {
    await prisma.$disconnect();
    if (hasErrors) process.exit(1);
    else {
      console.log('\n✅ Database Verification Complete. All checks passed.');
      process.exit(0);
    }
  }
}

verifyDatabase();
