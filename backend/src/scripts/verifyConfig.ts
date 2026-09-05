import dotenv from 'dotenv';
import redis from '../config/redis';
import esClient from '../config/elasticsearch';

dotenv.config();

console.log('--- Infrastructure Configuration Verification ---');
console.log(`Database URL: ${process.env.DATABASE_URL ? 'Configured' : 'Missing'}`);
console.log(`Redis URL: ${process.env.REDIS_URL ? 'Configured' : 'Missing'}`);
console.log(`Elasticsearch URL: ${process.env.ELASTICSEARCH_URL ? 'Configured' : 'Missing'}`);

console.log('\nNOTE: Since Docker Desktop is not running on the host machine, active connections cannot be verified.');
console.log('Please start Docker Desktop and run `docker-compose up -d` to verify full connectivity.');

process.exit(0);
