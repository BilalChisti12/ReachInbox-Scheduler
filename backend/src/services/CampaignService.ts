import { CampaignRepository } from '../repositories/CampaignRepository';
import { EmailJobRepository } from '../repositories/EmailJobRepository';
import { SenderRepository } from '../repositories/SenderRepository';
import { CreateCampaignInput } from '../validators/campaignValidator';
import { emailQueue } from '../config/queue';
import { ElasticsearchService } from './ElasticsearchService';
import crypto from 'crypto';

// Global defaults mapping to specifications
const DEFAULT_MIN_EMAIL_DELAY_MS = Number(process.env.MIN_EMAIL_DELAY_MS) || 2000;
const DEFAULT_MAX_EMAILS_PER_HOUR = Number(process.env.MAX_EMAILS_PER_HOUR) || 200;

export class CampaignService {
  private campaignRepo: CampaignRepository;
  private emailJobRepo: EmailJobRepository;
  private senderRepo: SenderRepository;
  private elasticsearchService: ElasticsearchService;

  constructor() {
    this.campaignRepo = new CampaignRepository();
    this.emailJobRepo = new EmailJobRepository();
    this.senderRepo = new SenderRepository();
    this.elasticsearchService = new ElasticsearchService();
  }

  async scheduleCampaign(userId: string, data: CreateCampaignInput) {
    // 1. Verify Sender Ownership and active status
    const sender = await this.senderRepo.findByIdAndUserId(data.senderId, userId);
    if (!sender) {
      throw new Error('Sender not found or does not belong to you');
    }
    if (!sender.active) {
      throw new Error('Sender is currently deactivated');
    }

    // 2. Calculate effective configurations based on global bounds
    // We respect the user's input directly, falling back to globals only if unspecified
    const effectiveDelay = data.delayBetweenEmails !== undefined 
      ? Math.max(data.delayBetweenEmails, DEFAULT_MIN_EMAIL_DELAY_MS)
      : DEFAULT_MIN_EMAIL_DELAY_MS;
      
    const effectiveHourlyLimit = data.hourlyLimit !== undefined 
      ? Math.min(data.hourlyLimit, DEFAULT_MAX_EMAILS_PER_HOUR)
      : DEFAULT_MAX_EMAILS_PER_HOUR;

    // 3. Create Campaign record
    const campaign = await this.campaignRepo.create(userId, sender.id, {
      subject: data.subject,
      body: data.body,
      startTime: data.startTime,
      delayBetweenEmails: effectiveDelay,
      hourlyLimit: effectiveHourlyLimit,
      totalRecipients: data.recipients.length,
    }, data.attachments);

    // 4. Create Individual Email Job records for each recipient conceptually mapping out the queue
    const emailJobsToCreate = data.recipients.map((recipient, index) => {
      // NOTE: Actual sending time delays will be strictly enforced by Redis in Phase 8.
      // Here we provide a nominal staggered scheduledAt based on the effective delay.
      const scheduledAt = new Date(data.startTime.getTime() + (index * effectiveDelay));
      
      return {
        id: crypto.randomUUID(), // Manually generate so we can pass to BullMQ
        campaignId: campaign.id,
        userId: userId,
        senderId: sender.id,
        recipient: recipient,
        subject: data.subject,
        body: data.body,
        scheduledAt: scheduledAt,
        // Idempotency: guarantees one email job per recipient per campaign
        idempotencyKey: `camp_${campaign.id}_req_${recipient}`
      };
    });

    // Using skipDuplicates ensures safety if retried
    await this.emailJobRepo.createMany(emailJobsToCreate);
    
    // Index newly scheduled jobs in Elasticsearch so they appear on the dashboard instantly
    try {
      const now = new Date();
      await Promise.all(emailJobsToCreate.map(job => 
        this.elasticsearchService.indexEmail({
          ...job,
          status: 'scheduled',
          createdAt: now,
          updatedAt: now,
          sentAt: null,
          failureReason: null,
          bullmqJobId: null,
          messageId: null,
          attemptCount: 0,
          sender: sender
        } as any)
      ));
    } catch (err: any) {
      console.error(`Non-fatal Elasticsearch indexing error during campaign creation: ${err.message}`);
    }
    
    // 5. Enqueue delayed jobs to BullMQ
    const bullmqJobs = emailJobsToCreate.map((job) => {
      const delay = Math.max(0, job.scheduledAt.getTime() - Date.now());
      return {
        name: 'send-email',
        data: { emailId: job.id, userId: job.userId },
        opts: {
          delay, // BullMQ delay in ms
          jobId: `email-job-${job.id}`, // Deterministic job id for idempotency in BullMQ
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      };
    });

    await emailQueue.addBulk(bullmqJobs);

    // Update scheduled count
    await this.campaignRepo.incrementCounts(campaign.id, { scheduled: emailJobsToCreate.length });

    return {
      campaignId: campaign.id,
      effectiveDelay,
      effectiveHourlyLimit,
      jobsCreated: emailJobsToCreate.length
    };
  }
}
