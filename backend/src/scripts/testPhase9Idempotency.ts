import { PrismaClient } from '@prisma/client';
import esClient from '../config/elasticsearch';
import { ElasticsearchService } from '../services/ElasticsearchService';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const esService = new ElasticsearchService();

async function runTests() {
  console.log('--- Phase 9: Elasticsearch Idempotency Test ---');

  // Grab any job
  const job = await prisma.emailJob.findFirst({ include: { sender: true } });
  if (!job) {
    console.log('No job found to test.');
    process.exit(1);
  }

  // 1. Check current count of this ID in Elasticsearch
  await esClient.indices.refresh({ index: 'email_jobs' });
  let countRes = await esClient.count({
    index: 'email_jobs',
    query: { term: { id: job.id } }
  });
  
  let initialCount = typeof countRes.count === 'number' ? countRes.count : (countRes as any).count;
  console.log(`Initial count for job ${job.id}: ${initialCount}`);

  // 2. Index it 3 more times
  console.log('Indexing the same job 3 times...');
  for (let i = 0; i < 3; i++) {
    await esService.indexEmail(job);
  }

  // 3. Check count again
  await esClient.indices.refresh({ index: 'email_jobs' });
  countRes = await esClient.count({
    index: 'email_jobs',
    query: { term: { id: job.id } }
  });
  let finalCount = typeof countRes.count === 'number' ? countRes.count : (countRes as any).count;
  
  console.log(`Final count for job ${job.id}: ${finalCount}`);
  console.assert(finalCount === 1, 'Idempotency failed! Expected exactly 1 document.');
  
  console.log('\n✅ Phase 9 Idempotency test passed successfully!');
  
  // Clean up
  await esClient.close();
  await prisma.$disconnect();
  process.exit(0);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
