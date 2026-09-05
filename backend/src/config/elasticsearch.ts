import { Client } from '@opensearch-project/opensearch';
import dotenv from 'dotenv';

dotenv.config();

const esUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
const esUsername = process.env.ELASTICSEARCH_USERNAME;
const esPassword = process.env.ELASTICSEARCH_PASSWORD;

const auth = esUsername && esPassword 
  ? { username: esUsername, password: esPassword }
  : undefined;

const esClient = new Client({
  node: esUrl,
  auth,
});

export default esClient;
