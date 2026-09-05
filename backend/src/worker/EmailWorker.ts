import { Worker, Job } from 'bullmq';
import { redisConnection, createBullConnection } from '../config/queue';
import { EmailJobRepository } from '../repositories/EmailJobRepository';
import { EmailService } from '../services/EmailService';
import { RateLimitService } from '../services/RateLimitService';
import { ElasticsearchService } from '../services/ElasticsearchService';
import { SlackService } from '../services/SlackService';
import { NotificationDeduplicationService } from '../services/NotificationDeduplicationService';
import { DelayedError } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

const emailJobRepo = new EmailJobRepository();
const emailService = new EmailService();
const rateLimitService = new RateLimitService();
const elasticsearchService = new ElasticsearchService();
const slackService = new SlackService();
const notificationDeduplication = new NotificationDeduplicationService();

export function startWorker() {
  const envConcurrency = Number(process.env.WORKER_CONCURRENCY) || 5;
  const concurrency = Math.min(envConcurrency, 1); // Strictly cap at 1 to completely avoid Ethereal timeout
  
  console.log(`Starting Email Worker with concurrency: ${concurrency}`);

  const worker = new Worker(
    'email-scheduler',
    async (job: Job) => {
      const { emailId, userId } = job.data;
      if (!emailId || !userId) {
        throw new Error(`Job ${job.id} is missing emailId or userId payload.`);
      }

      // 1. Fetch the email job with the sender and campaign from the DB
      const emailRecord = await emailJobRepo.findByIdWithContext(emailId);
      
      // 2. Validate records exist and are correct
      if (!emailRecord) {
        throw new Error(`EmailJob record ${emailId} not found in database.`);
      }
      
      if (emailRecord.userId !== userId) {
        throw new Error(`EmailJob record ${emailId} belongs to a different user.`);
      }

      const sender = emailRecord.sender;
      if (!sender) {
        throw new Error(`Sender for EmailJob ${emailId} not found.`);
      }

      if (!sender.active) {
        throw new Error(`Sender ${sender.id} is inactive.`);
      }

      // 3. State Check
      if (emailRecord.status === 'sent') {
        console.log(`Job ${emailId} is already sent. Safely skipping.`);
        return { skipped: true, reason: 'already_sent' };
      }
      
      if (emailRecord.status === 'processing') {
        console.error(`Job ${emailId} is stuck in processing. Aborting to prevent duplicate (crash protection).`);
        await emailJobRepo.markAsFailed(emailId, 'Job stalled in processing state (worker crash protection)');
        return { skipped: true, reason: 'stuck_in_processing' };
      }
      
      if (emailRecord.status === 'failed') {
         console.error(`Job ${emailId} is permanently failed. Skipping.`);
         return { skipped: true, reason: 'permanently_failed' };
      }

      // 4. Atomic Claim: scheduled -> processing
      console.log(`Attempting atomic claim on job ${emailId}...`);
      const claimed = await emailJobRepo.transitionStatus(emailId, userId, 'scheduled', 'processing');
      if (!claimed) {
        console.warn(`Failed to claim job ${emailId}. Another worker may be processing it.`);
        return { skipped: true, reason: 'claim_failed' };
      }

      // 4.0 Index 'processing' state to Elasticsearch for realtime Dashboard updates
      try {
        await elasticsearchService.indexEmail({ ...emailRecord, status: 'processing', sender });
      } catch (err: any) {
        console.error(`Non-fatal Elasticsearch indexing error for job ${emailId}: ${err.message}`);
      }

      // 4.1. Rate Limit Check (using Atomic Lua Script)
      const globalSenderLimit = Number(process.env.MAX_EMAILS_PER_HOUR) || 200;
      const campaignLimit = emailRecord.campaign.hourlyLimit;
      const senderLimit = globalSenderLimit;

      console.log(`Checking rate limit for Sender: ${sender.id} (Limit: ${senderLimit}), Campaign: ${emailRecord.campaign.id} (Limit: ${campaignLimit})`);
      
      const rateLimitResult = await rateLimitService.checkAndConsume(
        sender.id,
        emailRecord.campaign.id,
        senderLimit,
        campaignLimit
      );

      if (rateLimitResult !== 1) {
        // Calculate delay until the next hour starts
        const nextHour = new Date();
        nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0); // Start of next UTC hour
        const delayMs = Math.max(0, nextHour.getTime() - Date.now());
        const newScheduledAt = new Date(Date.now() + delayMs);
        
        console.log(`Rate limit exceeded for job ${emailId}. Reason code: ${rateLimitResult}`);
        console.log(`Delaying job ${emailId} by ${delayMs}ms until the next hour window.`);
        
        // Revert DB state safely to scheduled so it is eligible again later, and update its scheduled time
        await emailJobRepo.transitionStatus(emailId, userId, 'processing', 'scheduled', { scheduledAt: newScheduledAt });
        
        try {
          await elasticsearchService.indexEmail({ ...emailRecord, status: 'scheduled', scheduledAt: newScheduledAt, sender });
        } catch (err: any) {
          console.error(`Non-fatal ES indexing error on rate limit rollback for job ${emailId}: ${err.message}`);
        }

        await job.moveToDelayed(Date.now() + delayMs, job.token!);

        // --- PHASE 10: SLACK NOTIFICATION (Decoupled & Deduplicated) ---
        // Fire and forget - do not await or block the worker
        const limitType = rateLimitResult === -1 ? 'sender' : 'campaign';
        const limitReached = rateLimitResult === -1 ? senderLimit : campaignLimit;
        const now = new Date();
        const hourWindow = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}-${now.getUTCHours()}`;

        notificationDeduplication.acquireNotificationLock('ratelimit', sender.id, hourWindow)
          .then(async (lockResult) => {
            if (lockResult.acquired && lockResult.token) {
              console.log(`Acquired notification lock for sender ${sender.id}. Sending Slack notification...`);
              try {
                await slackService.sendRateLimitNotification(
                  userId,
                  sender.email,
                  emailRecord.campaignId,
                  limitReached,
                  limitType
                );
              } catch (err: any) {
                console.error(`Slack notification structurally failed (${err.message}). Releasing lock...`);
                await notificationDeduplication.releaseNotificationLock('ratelimit', sender.id, hourWindow, lockResult.token);
              }
            }
          })
          .catch(err => {
            console.error(`Error during Slack notification pipeline: ${err.message}`);
          });
        // -------------------------------------------------------------

        throw new DelayedError();
      }

      console.log(`Processing email job ${emailId} to ${emailRecord.recipient}...`);

      // 5. Send email using the existing EmailService
      try {
        const messageId = `${emailRecord.id}@reachinbox.local`;
        
        const result = await emailService.sendEmail(
          sender,
          emailRecord.recipient,
          emailRecord.subject,
          emailRecord.body,
          emailRecord.campaign.attachments || [],
          messageId
        );

        // 6. On success, securely update the DB status from processing -> sent
        const finalized = await emailJobRepo.transitionStatus(emailId, userId, 'processing', 'sent', {
          sentAt: new Date(),
          messageId: result.messageId || messageId
        });
        
        if (!finalized) {
          console.error(`CRITICAL: Failed to finalize status to sent for job ${emailId}.`);
        } else {
          console.log(`Successfully sent email job ${emailId}. Preview URL: ${result.previewUrl || 'N/A'}`);
          
          // 7. Index in Elasticsearch (Best effort, isolated failure)
          try {
            await elasticsearchService.indexEmail({ ...emailRecord, status: 'sent', sender, sentAt: new Date(), messageId: result.messageId || messageId });
          } catch (err: any) {
            console.error(`Non-fatal Elasticsearch indexing error for job ${emailId}: ${err.message}`);
          }
        }
        
        return result;
      } catch (error: any) {
        console.error(`Failed to send email job ${emailId}:`, error.message);
        
        // Refund the rate limit slot since this attempt failed and didn't result in a sent email
        try {
          await rateLimitService.refund(sender.id, emailRecord.campaign.id);
        } catch (refundErr: any) {
          console.error(`Failed to refund rate limit slot for job ${emailId}:`, refundErr.message);
        }
        
        if (job.attemptsMade + 1 >= (job.opts.attempts || 1)) {
          console.error(`Job ${emailId} has exhausted all retries. Marking as failed in DB.`);
          const failedJob = await emailJobRepo.markAsFailed(emailId, error.message);
          
          // 8. Index failed state in Elasticsearch (Best effort)
          try {
            await elasticsearchService.indexEmail({ ...failedJob, sender });
          } catch (err: any) {
            console.error(`Non-fatal Elasticsearch indexing error for failed job ${emailId}: ${err.message}`);
          }
        } else {
          // Rollback processing -> scheduled so it can be retried cleanly by BullMQ
          await emailJobRepo.transitionStatus(emailId, userId, 'processing', 'scheduled');
          
          try {
            await elasticsearchService.indexEmail({ ...emailRecord, status: 'scheduled', sender });
          } catch (err: any) {
            console.error(`Non-fatal ES indexing error on retry rollback for job ${emailId}: ${err.message}`);
          }
        }
        throw error; // Let BullMQ retry
      }
    },
    {
      connection: createBullConnection(),
      concurrency,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} has completed!`);
  });

  worker.on('failed', async (job, err) => {
    console.error(`Job ${job?.id} has failed with ${err.message}`);
  });

  return worker;
}
