import { Client } from '@opensearch-project/opensearch';

const url = "https://414b39a8c2:3ba6ee5058a0be11468a@brave-sassafras-1s5javm0.us-east-1.bonsaisearch.net";

const client = new Client({
  node: url
});

async function main() {
  try {
    console.log("Checking if index exists...");
    const indexExists = await client.indices.exists({ index: 'test_index_123' });
    console.log("Returns:", indexExists);
    console.log("Is body boolean?:", indexExists.body);
  } catch (err: any) {
    console.error("Error:", err);
  }
}

main();
