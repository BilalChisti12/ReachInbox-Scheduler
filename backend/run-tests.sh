#!/bin/bash
set -e
echo "Running all backend tests..."
npx tsx src/scripts/verifyAuth.ts
npx tsx src/scripts/verifyPhase5.ts
npx tsx src/scripts/testPhase6.ts
npx tsx src/scripts/testPhase7AlreadySent.ts
npx tsx src/scripts/testPhase7Concurrent.ts
npx tsx src/scripts/testPhase7CrashWindow.ts
npx tsx src/scripts/testPhase7DuplicateJobs.ts
npx tsx src/scripts/testPhase7Retry.ts
npx tsx src/scripts/testPhase8Concurrent.ts
npx tsx src/scripts/testPhase8DifferentSenders.ts
npx tsx src/scripts/testPhase8MultipleCampaigns.ts
npx tsx src/scripts/testPhase8SingleSender.ts
npx tsx src/scripts/testPhase9Search.ts
npx tsx src/scripts/testPhase9Idempotency.ts
npx tsx src/scripts/testPhase9FailureHandling.ts
npx tsx src/scripts/testPhase10OAuth.ts
npx tsx src/scripts/testPhase10Concurrency.ts
npx tsx src/scripts/testPhase10FailureHandling.ts
npx tsx src/scripts/testPhase11BullBoard.ts
echo "All tests passed successfully!"
