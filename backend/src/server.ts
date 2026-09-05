import app from './app';
import { startWorker } from './worker/EmailWorker';
import { ElasticsearchService } from './services/ElasticsearchService';

const PORT = process.env.PORT || 5000;
const elasticsearchService = new ElasticsearchService();

async function startServer() {
  await elasticsearchService.initIndex();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    startWorker();
  });
}

startServer().catch(console.error);
