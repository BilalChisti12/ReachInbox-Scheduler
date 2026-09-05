import 'dotenv/config';
import { startWorker } from './worker/EmailWorker';
import { ElasticsearchService } from './services/ElasticsearchService';

/**
 * worker.ts — Standalone BullMQ worker process.
 *
 * This is separate from server.ts so the worker runs in its own Docker container.
 * Benefits:
 *   - Worker and API can be restarted independently
 *   - Crash in worker does not affect the API
 *   - Worker can be scaled separately if needed
 *
 * In production: docker-compose.prod.yml runs this as the 'worker' service.
 * In development: run with `npm run worker:dev`
 */

const elasticsearchService = new ElasticsearchService();

async function startWorkerProcess() {
  console.log('[Worker] Starting BullMQ Worker...');

  // Ensure Elasticsearch index exists (idempotent — safe to call on every start)
  try {
    await elasticsearchService.initIndex();
    console.log('[Worker] Elasticsearch index ready');
  } catch (err: any) {
    // Non-fatal — worker still processes jobs even if ES is temporarily down
    console.warn(`[Worker] Elasticsearch init failed (non-fatal): ${err.message}`);
  }

  startWorker();
  console.log('[Worker] BullMQ Worker is running and listening for jobs');
}

startWorkerProcess().catch((err) => {
  console.error('[Worker] Failed to start:', err);
  process.exit(1);
});
