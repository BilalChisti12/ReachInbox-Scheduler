import Redis from 'ioredis';
import dotenv from 'dotenv';
import { getEnv } from './env';

dotenv.config();

const redisUrl = getEnv('REDIS_URL', 'redis://localhost:6379');

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required by BullMQ
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Successfully connected to Redis');
});

export default redis;
