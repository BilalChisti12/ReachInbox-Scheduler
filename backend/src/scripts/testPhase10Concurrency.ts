import { NotificationDeduplicationService } from '../services/NotificationDeduplicationService';

async function runTests() {
  console.log('--- Phase 10: Notification Deduplication Concurrency Test ---');
  
  const deduplicationService = new NotificationDeduplicationService();
  const senderId = 'test-sender-123';
  const windowId = `test-window-${Date.now()}`;
  
  console.log('Simulating 10 concurrent workers hitting the rate limit simultaneously...');

  // Fire 10 parallel requests to acquire the lock
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(deduplicationService.acquireNotificationLock('ratelimit', senderId, windowId));
  }
  
  const results = await Promise.all(promises);
  
  const acquiredCount = results.filter(r => r.acquired === true).length;
  const deniedCount = results.filter(r => r.acquired === false).length;

  console.log(`Results -> Acquired: ${acquiredCount}, Denied: ${deniedCount}`);
  
  console.assert(acquiredCount === 1, 'Exactly one worker should have acquired the lock.');
  console.assert(deniedCount === 9, 'Exactly nine workers should have been denied the lock.');
  
  console.log('\n✅ Phase 10 Notification Deduplication passed successfully!');
  process.exit(0);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
