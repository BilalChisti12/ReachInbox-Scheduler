import dotenv from 'dotenv';
import redis from '../config/redis';
import esClient from '../config/elasticsearch';

dotenv.config();

console.log('--- Infrastructure Configuration Verification ---');
console.log(`Database URL: ${process.env.DATABASE_URL ? 'Configured' : 'Missing'}`);
console.log(`Redis URL: ${process.env.REDIS_URL ? 'Configured' : 'Missing'}`);
console.log(`Elasticsearch URL: ${process.env.ELASTICSEARCH_URL ? 'Configured' : 'Missing'}`);

console.log('\nNOTE: Make sure your external database and redis are accessible before running this verification.');

process.exit(0);
