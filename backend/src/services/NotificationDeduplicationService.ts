import { redisConnection } from '../config/queue';
import { v4 as uuidv4 } from 'uuid';

const RELEASE_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

export class NotificationDeduplicationService {
  /**
   * Acquires an atomic lock in Redis using SET NX EX.
   * If it succeeds, the caller is the unique owner of the notification event.
   * 
   * @param type The type of notification (e.g. 'rate_limit')
   * @param entityId The ID of the entity (e.g. Sender ID)
   * @param windowId A time window identifier (e.g. '2026-09-04-05' for an hour)
   * @param ttlSeconds How long the lock should be held (default 7200 seconds / 2 hours)
   * @returns Object containing whether the lock was acquired, and if so, a unique token
   */
  async acquireNotificationLock(
    type: string, 
    entityId: string, 
    windowId: string, 
    ttlSeconds: number = 7200
  ): Promise<{ acquired: boolean, token?: string }> {
    const key = `notification_lock:${type}:${entityId}:${windowId}`;
    const token = uuidv4();
    
    try {
      // SET key token EX ttl NX
      const result = await redisConnection.set(key, token, 'EX', ttlSeconds, 'NX');
      
      // 'OK' means the key was set (lock acquired). Null/undefined means key existed (lock denied).
      if (result === 'OK') {
        return { acquired: true, token };
      }
      return { acquired: false };
    } catch (error) {
      console.error(`Failed to acquire notification lock for ${key}`, error);
      // In case of Redis failure, we default to false to prevent spamming notifications on infrastructure issues
      return { acquired: false }; 
    }
  }

  /**
   * Safely releases a notification lock only if the caller holds the correct token.
   * Prevents deleting a lock that has expired and been re-acquired by another worker.
   */
  async releaseNotificationLock(type: string, entityId: string, windowId: string, token: string): Promise<boolean> {
    const key = `notification_lock:${type}:${entityId}:${windowId}`;
    try {
      const result = await redisConnection.eval(RELEASE_LOCK_SCRIPT, 1, key, token);
      return result === 1;
    } catch (error) {
      console.error(`Failed to release notification lock for ${key}`, error);
      return false;
    }
  }
}
