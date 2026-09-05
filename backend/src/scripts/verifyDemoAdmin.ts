import { PrismaClient } from '@prisma/client';
import http from 'http';
import app from '../app';

const prisma = new PrismaClient();
const PORT = 5002; // Use a different port to avoid conflicts
const BASE_URL = `http://localhost:${PORT}`;
let server: http.Server;

async function runVerification() {
  server = app.listen(PORT);
  let passed = 0;
  let failed = 0;

  const assertEqual = (expected: any, actual: any, message: string) => {
    if (expected === actual) {
      console.log(`✅ Passed: ${message}`);
      passed++;
    } else {
      console.log(`❌ Failed: ${message} (Expected ${expected}, got ${actual})`);
      failed++;
    }
  };

  const assertDefined = (actual: any, message: string) => {
    if (actual !== undefined && actual !== null) {
      console.log(`✅ Passed: ${message}`);
      passed++;
    } else {
      console.log(`❌ Failed: ${message}`);
      failed++;
    }
  };

  const assertUndefined = (actual: any, message: string) => {
    if (actual === undefined || actual === null) {
      console.log(`✅ Passed: ${message}`);
      passed++;
    } else {
      console.log(`❌ Failed: ${message}`);
      failed++;
    }
  };

  try {
    const demoEmail = process.env.DEMO_ADMIN_EMAIL || 'demo@reachinbox.com';
    const demoPassword = process.env.DEMO_ADMIN_PASSWORD || 'securepassword123';

    // Clear test data
    await prisma.user.deleteMany({
      where: { email: { in: ['usera@test.com', 'malicious@test.com'] } }
    });

    console.log('\n--- 1. Authentication Tests ---');
    
    // A. Demo admin can log in with valid credentials
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: demoEmail, password: demoPassword })
    });
    assertEqual(200, loginRes.status, 'Demo admin can log in with valid credentials');
    const demoCookie = loginRes.headers.getSetCookie() || [];
    
    // B. Invalid demo password is rejected
    const invalidLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: demoEmail, password: 'wrongpassword' })
    });
    assertEqual(401, invalidLoginRes.status, 'Invalid demo password is rejected');
    
    // C. Unknown demo email is rejected
    const unknownLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unknown@admin.com', password: demoPassword })
    });
    assertEqual(401, unknownLoginRes.status, 'Unknown demo email is rejected');
    
    // D & E. Demo admin receives a valid session and NO password hash
    const loginData = await loginRes.json();
    assertDefined(loginData.user, 'Demo admin receives valid user payload');
    assertUndefined(loginData.user.passwordHash, 'Password hash is NEVER returned in login payload');

    // F & G. Normal email/password registration cannot create an admin
    const malRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: 'malicious@test.com', 
        password: 'password123',
        isPlatformAdmin: true // Attempt privilege escalation
      })
    });
    assertEqual(201, malRes.status, 'Malicious registration created (but should ignore flag)');
    const malData = await malRes.json();
    assertEqual(false, malData.user.isPlatformAdmin, 'Registration ignores isPlatformAdmin payload (privilege escalation blocked)');

    console.log('\n--- 2. Bull Board Authorization Tests ---');
    
    // A. Unauthenticated request -> 401
    const unauthQ = await fetch(`${BASE_URL}/admin/queues`);
    assertEqual(401, unauthQ.status, 'Unauthenticated access to Bull Board returns 401');

    // B. Normal authenticated user -> 403
    const normalCookie = malRes.headers.getSetCookie() || [];
    const normalQ = await fetch(`${BASE_URL}/admin/queues`, { headers: { Cookie: normalCookie.join('; ') } });
    assertEqual(403, normalQ.status, 'Normal user access to Bull Board returns 403');

    // C. Demo admin -> 200
    const demoQ = await fetch(`${BASE_URL}/admin/queues`, { headers: { Cookie: demoCookie.join('; ') } });
    assertEqual(200, demoQ.status, 'Demo admin access to Bull Board returns 200');

    console.log('\n--- 3. Tenant Isolation Tests ---');
    
    // Create User A
    const userARes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'usera@test.com', password: 'password123' })
    });
    const userACookie = userARes.headers.getSetCookie() || [];
    
    // User A creates a sender
    await fetch(`${BASE_URL}/api/senders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: userACookie.join('; ') },
      body: JSON.stringify({
        email: 'sender@usera.com',
        smtpHost: 'smtp.ethereal.email',
        smtpPort: 587,
        smtpUsername: 'userA',
        smtpPassword: 'passwordA'
      })
    });

    // Demo Admin creates a sender
    await fetch(`${BASE_URL}/api/senders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: demoCookie.join('; ') },
      body: JSON.stringify({
        email: 'sender@demoadmin.com',
        smtpHost: 'smtp.ethereal.email',
        smtpPort: 587,
        smtpUsername: 'demoAdmin',
        smtpPassword: 'passwordAdmin'
      })
    });

    // User A should only see 1 sender
    const userAFetch = await fetch(`${BASE_URL}/api/senders`, { headers: { Cookie: userACookie.join('; ') } });
    const userAData = await userAFetch.json();
    assertEqual(1, userAData.length, 'User A only sees their own 1 sender');
    if (userAData.length > 0) assertEqual('sender@usera.com', userAData[0].email, 'User A sees correct sender');

    // Demo Admin should ONLY see their own 1 sender (NOT User A's sender)
    const demoFetch = await fetch(`${BASE_URL}/api/senders`, { headers: { Cookie: demoCookie.join('; ') } });
    const demoData = await demoFetch.json();
    assertEqual(1, demoData.length, 'Demo Admin ONLY sees their own 1 sender');
    if (demoData.length > 0) assertEqual('sender@demoadmin.com', demoData[0].email, 'Demo Admin sees correct sender (isolation enforced)');

    console.log(`\n============================`);
    console.log(`Tests Complete: ${passed} Passed, ${failed} Failed`);
    console.log(`============================\n`);

    if (failed > 0) {
      process.exit(1);
    }

  } catch (error: any) {
    console.error('Test execution failed:', error);
    process.exit(1);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runVerification();
