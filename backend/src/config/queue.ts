import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisOptions: any = {
  maxRetriesPerRequest: null,
};

// Force TLS for Upstash to prevent ECONNRESET
if (redisUrl.includes('upstash.io')) {
  redisOptions.tls = { rejectUnauthorized: false };
}

export const redisConnection = new IORedis(redisUrl, redisOptions);

export const emailQueue = new Queue('email-scheduler', {
  connection: redisConnection,
});
