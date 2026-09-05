import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { ElasticsearchService } from '../src/services/ElasticsearchService';

const prisma = new PrismaClient();
const esService = new ElasticsearchService();

async function main() {
  console.log('Seeding development data...');
  
  // 1. Create Hiring Admin User
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('admin123', salt);

  const admin = await prisma.user.upsert({
    where: { email: 'hiring@outboxlabs.com' },
    update: {
      isPlatformAdmin: true,
      passwordHash
    },
    create: {
      email: 'hiring@outboxlabs.com',
      name: 'Hiring Manager (Admin)',
      passwordHash,
      isPlatformAdmin: true
    }
  });
  console.log(`Admin User created: ${admin.email}`);

  // 2. Create the Standard Demo User (for Google login/standard login)
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@outboxlabs.com' },
    update: {
      passwordHash // allow them to login with demo@outboxlabs.com / admin123 if Google OAuth isn't used
    },
    create: {
      googleId: 'google-oauth2|demo123',
      email: 'demo@outboxlabs.com',
      name: 'Demo Tenant',
      passwordHash,
      isPlatformAdmin: true
    }
  });
  console.log(`Standard Demo User created: ${demoUser.email}`);

  // 3. Create Senders for Admin
  const adminSender1 = await prisma.sender.upsert({
    where: { id: 'admin-sender-1' },
    update: {},
    create: {
      id: 'admin-sender-1',
      userId: admin.id,
      email: 'sales@outboxlabs.com',
      displayName: 'Outbox Sales',
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
      smtpUsername: 'ethereal_user1',
      smtpPassword: 'ethereal_password'
    }
  });

  const adminSender2 = await prisma.sender.upsert({
    where: { id: 'admin-sender-2' },
    update: {},
    create: {
      id: 'admin-sender-2',
      userId: admin.id,
      email: 'support@outboxlabs.com',
      displayName: 'Outbox Support',
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
      smtpUsername: 'ethereal_user2',
      smtpPassword: 'ethereal_password'
    }
  });

  // 4. Create Sender for Demo User
  const demoSender = await prisma.sender.upsert({
    where: { id: 'demo-sender-1' },
    update: {},
    create: {
      id: 'demo-sender-1',
      userId: demoUser.id,
      email: 'demo-sender@ethereal.email',
      displayName: 'Demo Sender',
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
      smtpUsername: 'ethereal_user',
      smtpPassword: 'ethereal_password'
    }
  });
  console.log(`Senders created for all users`);

  // 5. Create a Campaign for Demo User
  const demoCampaign = await prisma.campaign.upsert({
    where: { id: 'demo-camp-1' },
    update: {},
    create: {
      id: 'demo-camp-1',
      userId: demoUser.id,
      senderId: demoSender.id,
      subject: 'Demo User Newsletter',
      body: 'Hello from the demo account.',
      startTime: new Date(),
      delayBetweenEmails: 2000,
      hourlyLimit: 100,
      totalRecipients: 2,
      scheduledCount: 1,
      sentCount: 1,
      failedCount: 0,
      status: 'completed'
    }
  });

  // 6. Create a Campaign for Admin
  const adminCampaign = await prisma.campaign.upsert({
    where: { id: 'admin-camp-1' },
    update: {},
    create: {
      id: 'admin-camp-1',
      userId: admin.id,
      senderId: adminSender1.id,
      subject: 'Welcome to Outbox Labs!',
      body: 'Hello,\n\nWe are excited to have you on board. **ReachInbox** is the best email job scheduler.\n\nBest,\nSales Team',
      startTime: new Date(),
      delayBetweenEmails: 2000,
      hourlyLimit: 100,
      totalRecipients: 3,
      scheduledCount: 1,
      sentCount: 1,
      failedCount: 1,
      status: 'partially_failed'
    }
  });
  console.log(`Campaigns created`);

  // 7. Create EmailJobs
  const now = new Date();
  
  const jobs = [
    // Admin Jobs
    {
      id: 'admin-job-1',
      campaignId: adminCampaign.id,
      userId: admin.id,
      senderId: adminSender1.id,
      recipient: 'candidate1@example.com',
      subject: adminCampaign.subject,
      body: adminCampaign.body,
      scheduledAt: new Date(now.getTime() - 100000),
      sentAt: new Date(now.getTime() - 95000),
      status: 'sent' as const,
      idempotencyKey: `seed_${adminCampaign.id}_req_candidate1@example.com`,
      messageId: 'seed-msg-1@reachinbox.local'
    },
    {
      id: 'admin-job-2',
      campaignId: adminCampaign.id,
      userId: admin.id,
      senderId: adminSender1.id,
      recipient: 'candidate2@example.com',
      subject: adminCampaign.subject,
      body: adminCampaign.body,
      scheduledAt: new Date(now.getTime() - 50000),
      status: 'failed' as const,
      failureReason: 'SMTP connection timeout',
      idempotencyKey: `seed_${adminCampaign.id}_req_candidate2@example.com`
    },
    {
      id: 'admin-job-3',
      campaignId: adminCampaign.id,
      userId: admin.id,
      senderId: adminSender1.id,
      recipient: 'candidate3@example.com',
      subject: adminCampaign.subject,
      body: adminCampaign.body,
      scheduledAt: new Date(now.getTime() + 500000), // Future
      status: 'scheduled' as const,
      idempotencyKey: `seed_${adminCampaign.id}_req_candidate3@example.com`
    },
    // Demo Jobs
    {
      id: 'demo-job-1',
      campaignId: demoCampaign.id,
      userId: demoUser.id,
      senderId: demoSender.id,
      recipient: 'test1@demo.com',
      subject: demoCampaign.subject,
      body: demoCampaign.body,
      scheduledAt: new Date(now.getTime() - 100000),
      sentAt: new Date(now.getTime() - 95000),
      status: 'sent' as const,
      idempotencyKey: `seed_${demoCampaign.id}_req_test1@demo.com`,
      messageId: 'seed-msg-demo-1@reachinbox.local'
    },
    {
      id: 'demo-job-2',
      campaignId: demoCampaign.id,
      userId: demoUser.id,
      senderId: demoSender.id,
      recipient: 'test2@demo.com',
      subject: demoCampaign.subject,
      body: demoCampaign.body,
      scheduledAt: new Date(now.getTime() + 500000),
      status: 'scheduled' as const,
      idempotencyKey: `seed_${demoCampaign.id}_req_test2@demo.com`
    }
  ];

  for (const job of jobs) {
    await prisma.emailJob.upsert({
      where: { id: job.id },
      update: {},
      create: job
    });
  }
  console.log(`EmailJobs created`);

  // 8. Index into Elasticsearch
  console.log(`Indexing to Elasticsearch...`);
  for (const job of jobs) {
    try {
      const sender = job.id.startsWith('admin') ? adminSender1 : demoSender;
      await esService.indexEmail({
        ...job,
        sender,
        createdAt: now,
        updatedAt: now
      } as any);
    } catch (e) {
      console.log('ES Indexing failed:', (e as any).message);
    }
  }

  console.log('Seed successful.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
