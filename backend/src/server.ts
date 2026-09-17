import app from './app';
import { ElasticsearchService } from './services/ElasticsearchService';

const PORT = process.env.PORT || 5000;
const elasticsearchService = new ElasticsearchService();

async function startServer() {
  // Initialize Elasticsearch index — non-blocking.
  // If ES is temporarily unavailable (cold start, network issue), the server
  // still starts. Search degrades gracefully; all other features work fine.
  try {
    await elasticsearchService.initIndex();
  } catch (err: any) {
    console.warn(`[Startup] Elasticsearch init failed (non-fatal): ${err.message}`);
    console.warn('[Startup] Search functionality may be limited until ES becomes available.');
  }

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(console.error);

