import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { getEnv } from './env';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = getEnv('REDIS_URL', 'redis://localhost:6379');

const redisOptions: any = {
  maxRetriesPerRequest: null,
};

// Force TLS for Upstash to prevent ECONNRESET
if (redisUrl.includes('upstash.io')) {
  redisOptions.tls = { rejectUnauthorized: false };
}

export const redisConnection = new Redis(redisUrl, redisOptions);

export const createBullConnection = () => new Redis(redisUrl, redisOptions);

export const emailQueue = new Queue('email-scheduler', {
  connection: createBullConnection(),
});
