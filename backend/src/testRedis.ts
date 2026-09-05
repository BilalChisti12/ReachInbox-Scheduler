import Redis from 'ioredis';
import session from 'express-session';
import RedisStore from 'connect-redis';

// Use the password from the user's local .env, but formatted as a proper URL
const url = "rediss://default:gQAAAAAAAfUkAAIgcDI4ZWFkMGViNzhjNzg0ZmZmYjZkOWE1YTY5OGU3NDE2NA@perfect-scorpion-128292.upstash.io:6379";

async function main() {
  const redis = new Redis(url, { maxRetriesPerRequest: null });
  
  redis.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  try {
    console.log("Pinging redis...");
    await redis.ping();
    console.log("Ping successful.");
    
    console.log("Testing SET...");
    await redis.set("test_key", "test_value", "EX", 100);
    console.log("SET successful.");

    console.log("Testing connect-redis store...");
    const store = new RedisStore({ client: redis, prefix: 'test:sess:' });
    await new Promise((resolve, reject) => {
        store.set("test_session", { cookie: { maxAge: 1000 } } as any, (err) => {
            if (err) reject(err);
            else resolve(null);
        });
    });
    console.log("Store SET successful.");
    
  } catch (e) {
    console.error("Caught Exception:", e);
  } finally {
    redis.disconnect();
  }
}

main();
