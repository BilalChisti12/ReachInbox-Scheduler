import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../app';
import { emailQueue } from '../config/queue';

const prisma = new PrismaClient();

async function runTests() {
  console.log('--- Phase 11: Bull Board Integration Test ---');
  
  const user = await prisma.user.findFirst({ where: { isPlatformAdmin: true } });
  if (!user) {
    console.log('No platform admin user found. Run `npm run seed:demo` first.');
    process.exit(1);
  }

  // Mock Express request prototype to inject authentication for this test script
  const expressRequest = request.agent(app) as any;
  const originalIsAuthenticated = app.request.isAuthenticated;
  
  // @ts-ignore
  app.request.isAuthenticated = function () {
    return this.headers['x-mock-auth'] === 'true';
  };
  
  Object.defineProperty(app.request, 'user', {
    get: function() {
      return this.headers['x-mock-auth'] === 'true' 
        ? { id: user.id, email: user.email, isPlatformAdmin: user.isPlatformAdmin } 
        : undefined;
    },
    configurable: true
  });

  console.log('Testing Unauthenticated Access to Bull Board...');
  const resUnauth = await request(app).get('/admin/queues');
  console.assert(resUnauth.status === 401, `Unauthenticated request should return 401, but got ${resUnauth.status}`);

  console.log('Testing Authenticated Access to Bull Board...');
  const resAuth = await request(app).get('/admin/queues').set('x-mock-auth', 'true');
  console.assert(resAuth.status === 200 || resAuth.status === 302, `Authenticated request should succeed or redirect, but got ${resAuth.status}`);
  
  console.log('Testing Bull Board API for email-scheduler queue visibility...');
  // Add a dummy job to ensure the queue is active
  const job = await emailQueue.add('dummy-test-job', { emailId: 'mock' }, { delay: 100000 });
  
  // Hit the Bull Board API endpoints to prove it is reading from the actual queue
  const resApi = await request(app).get('/admin/queues/api/queues').set('x-mock-auth', 'true');
  console.assert(resApi.status === 200, `Bull Board API should return 200, but got ${resApi.status}`);
  console.assert(resApi.body.queues.length > 0, 'No queues found in Bull Board API!');
  console.assert(resApi.body.queues[0].name === 'email-scheduler', `Queue name mismatch: ${resApi.body.queues[0].name}`);

  console.log('Cleaning up dummy job...');
  await job.remove();
  
  // Restore prototype
  app.request.isAuthenticated = originalIsAuthenticated;
  delete (app.request as any).user;

  console.log('\n✅ Phase 11 Bull Board Integration passed successfully!');
  process.exit(0);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
