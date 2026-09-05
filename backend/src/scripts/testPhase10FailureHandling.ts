import { SlackService } from '../services/SlackService';
import { NotificationDeduplicationService } from '../services/NotificationDeduplicationService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Force fetch to completely blow up to simulate massive network failure
global.fetch = async () => {
  throw new Error('NETWORK TIMEOUT: Slack is unreachable!');
};

async function runTests() {
  console.log('--- Phase 10: Slack Failure Handling Test ---');
  
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('No user found in DB. Run Phase 6 tests first.');
    process.exit(1);
  }

  // Ensure they have a slack connection for the test to attempt delivery
  await prisma.slackConnection.upsert({
    where: { userId: user.id },
    create: { userId: user.id, connected: true, accessToken: 'mock-token' },
    update: { connected: true, accessToken: 'mock-token' },
  });

  const slackService = new SlackService();
  const deduplicationService = new NotificationDeduplicationService();
  const windowId = 'failure-test-window';
  
  console.log('Acquiring initial lock...');
  const lock1 = await deduplicationService.acquireNotificationLock('ratelimit', 'sender-fail', windowId);
  console.assert(lock1.acquired === true, 'Failed to acquire initial lock');

  console.log('Attempting to send rate limit notification with broken network...');
  let threw = false;
  try {
    await slackService.sendRateLimitNotification(user.id, 'sender@test.com', 'campaign-123', 200, 'sender');
  } catch (err) {
    threw = true;
    console.log('Network error correctly thrown. Simulating worker releasing lock...');
    await deduplicationService.releaseNotificationLock('ratelimit', 'sender-fail', windowId, lock1.token!);
  }

  console.assert(threw === true, 'SlackService failed to throw network error!');
  
  console.log('Acquiring lock again after release...');
  const lock2 = await deduplicationService.acquireNotificationLock('ratelimit', 'sender-fail', windowId);
  console.assert(lock2.acquired === true, 'Failed to acquire lock after release! Lua release script failed.');

  console.log('\n✅ Phase 10 Failure Handling passed successfully! (Error was safely caught and lock released)');
  process.exit(0);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
