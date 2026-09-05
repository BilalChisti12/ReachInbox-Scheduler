import { ElasticsearchService } from './services/ElasticsearchService';

async function main() {
  const service = new ElasticsearchService();
  console.log("Initializing index...");
  await service.initIndex();
  console.log("Done.");
}

main().catch(console.error);
