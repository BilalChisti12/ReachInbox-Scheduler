import { Client } from '@opensearch-project/opensearch';

const url = "https://414b39a8c2:3ba6ee5058a0be11468a@brave-sassafras-1s5javm0.us-east-1.bonsaisearch.net";
const client = new Client({ node: url });

async function main() {
  try {
    const result = await client.search({
      index: 'email_jobs',
      body: {
        query: { match_all: {} }
      }
    });
    console.log(result.body);
  } catch (err: any) {
    console.error("ES Error:", err.meta ? err.meta.body : err);
  }
}

main();
