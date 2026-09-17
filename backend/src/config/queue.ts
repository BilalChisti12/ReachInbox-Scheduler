import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Shared connection for standard API operations (e.g., rate limits)
export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

// Helper for BullMQ to create dedicated connections
export const createRedisConnection = () => new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

// Queue MUST have its own dedicated connection to prevent deadlocks
export const emailQueue = new Queue('email-scheduler', {
  connection: createRedisConnection(),
});
