import { Client } from '@opensearch-project/opensearch';

const url = "https://414b39a8c2:3ba6ee5058a0be11468a@brave-sassafras-1s5javm0.us-east-1.bonsaisearch.net";

const client = new Client({
  node: url
});

async function main() {
  try {
    console.log("Pinging Elasticsearch/OpenSearch...");
    const res = await client.ping();
    console.log("Ping result:", res.body);
    
    console.log("Getting info...");
    const info = await client.info();
    console.log("Info:", info.body);
  } catch (err: any) {
    console.error("ES Error:", err.meta ? err.meta.body : err);
  }
}

main();
