import { PrismaClient } from '@prisma/client';
import esClient from '../config/elasticsearch';
import { ElasticsearchService } from '../services/ElasticsearchService';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const esService = new ElasticsearchService();

async function run() {
  console.log('--- Starting Elasticsearch Backfill ---');
  
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

    const bulkResponse = await esClient.bulk({ refresh: true, operations });

    if (bulkResponse.errors) {
      console.error('Bulk insert encountered errors!');
      const erroredDocuments: any[] = [];
      bulkResponse.items.forEach((action, i) => {
        const operation = Object.keys(action)[0];
        if (action[operation as keyof typeof action]?.error) {
          erroredDocuments.push({
            status: action[operation as keyof typeof action]?.status,
            error: action[operation as keyof typeof action]?.error,
          });
        }
      });
      console.log(erroredDocuments);
    }

    processed += jobs.length;
    console.log(`Indexed ${processed} jobs...`);
    cursor = jobs[jobs.length - 1].id;
  }

  console.log(`--- Backfill Complete. Total Indexed: ${processed} ---`);
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
