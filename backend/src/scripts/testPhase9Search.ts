import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import esClient from '../config/elasticsearch';
import emailRoutes from '../routes/emails';

const prisma = new PrismaClient();

async function runTests() {
  console.log('--- Phase 9: Elasticsearch Search & Isolation Test ---');
  
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('No user found in DB. Please run Phase 6 tests first to populate data.');
    process.exit(1);
  }

  const app = express();
  app.use(express.json());
  
  // Mock authentication middleware
  app.use((req, res, next) => {
    req.user = { id: user.id, email: user.email } as any;
    // @ts-ignore
    req.isAuthenticated = () => true;
    next();
  });
  
  app.use('/api/emails', emailRoutes);

  // Wait for Elasticsearch to be fully refreshed
  await esClient.indices.refresh({ index: 'email_jobs' });

  // Test 1: Search all emails for this user
  console.log('\nTesting GET /api/emails/search without query...');
  const resAll = await request(app).get('/api/emails/search');
  
  if (resAll.status !== 200) {
    console.error('Failed to get emails:', resAll.body);
    process.exit(1);
  }
  
  console.log(`Found ${resAll.body.meta.total} total emails for user ${user.id}.`);
  console.assert(resAll.body.data.every((j: any) => j.userId === user.id), 'Tenant isolation failed!');

  // Test 2: Search with specific term (e.g., 'test' or subject content)
  console.log('\nTesting GET /api/emails/search?q=hello...');
  const resQuery = await request(app).get('/api/emails/search?q=hello');
  
  console.log(`Found ${resQuery.body.meta.total} emails matching 'hello'.`);

  // Test 3: Pagination
  console.log('\nTesting GET /api/emails/search?limit=2&page=1...');
  const resPage = await request(app).get('/api/emails/search?limit=2&page=1');
  console.assert(resPage.body.data.length <= 2, 'Pagination limit failed');
  console.assert(resPage.body.meta.limit === 2, 'Pagination meta limit incorrect');

  console.log('\n✅ Phase 9 Search tests passed successfully!');
  process.exit(0);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
