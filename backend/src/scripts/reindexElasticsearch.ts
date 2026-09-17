import { PrismaClient } from '@prisma/client';
import { ElasticsearchService } from '../services/ElasticsearchService';

const prisma = new PrismaClient();
const es = new ElasticsearchService();

async function sync() {
  console.log('Fetching all email jobs...');
  const jobs = await prisma.emailJob.findMany({
    include: {
      sender: true
    }
  });

  console.log(`Found ${jobs.length} jobs. Indexing...`);
  
  let count = 0;
  for (const job of jobs) {
    try {
      await es.indexEmail(job);
      count++;
    } catch (e: any) {
      console.error(`Failed to index job ${job.id}:`, e.message);
    }
  }

  console.log(`Successfully synced ${count}/${jobs.length} jobs to Elasticsearch!`);
  process.exit(0);
}

sync().catch(e => {
  console.error(e);
  process.exit(1);
});
