import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import esClient from '../config/elasticsearch';
import { ElasticsearchService } from '../services/ElasticsearchService';

const prisma = new PrismaClient();
const esService = new ElasticsearchService();

export class AdminController {
  async reindexEmails(req: Request, res: Response): Promise<void> {
    // We respond immediately and process in the background
    res.json({ message: 'Elasticsearch reindexing started in the background.' });

    // Background process
    (async () => {
      try {
        console.log('--- Starting Elasticsearch Backfill (API Triggered) ---');
        await esService.initIndex();

        const BATCH_SIZE = 500;
        let processed = 0;
        let cursor: string | undefined;

        while (true) {
          const jobs = await prisma.emailJob.findMany({
            take: BATCH_SIZE,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            include: {
              sender: true
            },
            orderBy: {
              id: 'asc'
            }
          });

          if (jobs.length === 0) {
            break;
          }

          const operations = jobs.flatMap(job => [
            { index: { _index: 'email_jobs', _id: job.id } },
            {
              id: job.id,
              userId: job.userId,
              campaignId: job.campaignId,
              senderId: job.senderId,
              sender: job.sender.email,
              recipient: job.recipient,
              subject: job.subject,
              body: job.body,
              status: job.status,
              scheduledAt: job.scheduledAt,
              sentAt: job.sentAt,
              createdAt: job.createdAt,
              updatedAt: job.updatedAt
            }
          ]);

          const bulkResponse = await esClient.bulk({ refresh: true, body: operations });

          if ((bulkResponse.body as any).errors) {
             console.error('Bulk insert encountered errors!');
          }

          processed += jobs.length;
          console.log(`Indexed ${processed} jobs...`);
          cursor = jobs[jobs.length - 1].id;
        }

        console.log(`--- Backfill Complete. Total Indexed: ${processed} ---`);
      } catch (err: any) {
        console.error('Failed to complete background reindex:', err);
      }
    })();
  }
}
