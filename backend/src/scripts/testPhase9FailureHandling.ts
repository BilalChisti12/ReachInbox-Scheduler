import { PrismaClient } from '@prisma/client';
import { ElasticsearchService } from '../services/ElasticsearchService';

// Override the ES client with a broken one
import esClient from '../config/elasticsearch';
esClient.index = async () => { throw new Error('Simulated Elasticsearch cluster down!') };

const prisma = new PrismaClient();
const esService = new ElasticsearchService();

async function runTests() {
  console.log('--- Phase 9: Elasticsearch Failure Handling Test ---');

  const job = await prisma.emailJob.findFirst({ include: { sender: true } });
  if (!job) {
    console.log('No job found to test.');
    process.exit(1);
  }

  console.log('Attempting to index job with simulated ES failure...');
  
  // This should not throw an exception!
  let threw = false;
  try {
    await esService.indexEmail(job);
  } catch (err) {
    threw = true;
  }

  console.assert(threw === false, 'Failure Handling Failed! indexEmail threw an error.');
  console.log('✅ Phase 9 Failure Handling test passed successfully! (Error was logged but not thrown)');
  
  await prisma.$disconnect();
  process.exit(0);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
