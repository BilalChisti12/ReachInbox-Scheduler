
import { PrismaClient } from '@prisma/client';
import http from 'http';
import app from '../app';

const prisma = new PrismaClient();

const PORT = 5001;
const BASE_URL = `http://localhost:${PORT}`;
let server: http.Server;

async function runTests() {
  server = app.listen(PORT);

  try {
    // Clear test users
    await prisma.user.deleteMany({
      where: { email: { in: ['normal@test.com', 'admin@test.com'] } }
    });

    console.log('--- TEST A: Unauthenticated ---');
    try {
      const res = await fetch(`${BASE_URL}/admin/queues`);
      if (res.status === 401) {
        console.log('✅ Passed: Unauthenticated user rejected with 401.');
      } else {
        console.log(`❌ Failed: Expected 401, got ${res.status}`);
      }
    } catch (err: any) {
      console.log(`❌ Failed: Request error ${err.message}`);
    }

    console.log('\n--- Setting up users ---');
    
    // Register Normal User
    const normalRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'normal@test.com',
        password: 'password123',
        name: 'Normal User'
      })
    });
    const normalCookie = normalRes.headers.getSetCookie() || [];
    
    // Register Admin User
    const adminRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@test.com',
        password: 'password123',
        name: 'Admin User'
      })
    });
    let adminCookie = adminRes.headers.getSetCookie() || [];
    const adminData = await adminRes.json();
    const adminUserId = adminData.user.id;

    // Promote Admin User
    await prisma.user.update({
      where: { id: adminUserId },
      data: { isPlatformAdmin: true }
    });

    // Re-login Admin to refresh session if needed
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@test.com',
        password: 'password123'
      })
    });
    adminCookie = adminLoginRes.headers.getSetCookie() || [];

    console.log('--- TEST B: Normal Authenticated User ---');
    try {
      const res = await fetch(`${BASE_URL}/admin/queues`, {
        headers: { Cookie: normalCookie.join('; ') }
      });
      if (res.status === 403) {
        console.log('✅ Passed: Normal user rejected with 403 Forbidden.');
      } else {
        console.log(`❌ Failed: Expected 403, got ${res.status}`);
      }
    } catch (err: any) {
      console.log(`❌ Failed: Request error ${err.message}`);
    }

    console.log('\n--- TEST C: Platform Administrator ---');
    try {
      const res = await fetch(`${BASE_URL}/admin/queues`, {
        headers: { Cookie: adminCookie.join('; ') }
      });
      if (res.status === 200) {
        console.log('✅ Passed: Platform administrator allowed access to Bull Board (200 OK).');
      } else {
        console.log(`❌ Failed: Admin was rejected with ${res.status}`);
      }
    } catch (err: any) {
      console.log(`❌ Failed: Admin request error ${err.message}`);
    }

    console.log('\n--- TEST D: Tenant Isolation ---');
    // Normal user creates a sender
    const senderRes = await fetch(`${BASE_URL}/api/senders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: normalCookie.join('; ')
      },
      body: JSON.stringify({
        email: 'sender@normal.com',
        smtpHost: 'smtp.ethereal.email',
        smtpPort: 587,
        smtpUsername: 'user',
        smtpPassword: 'password'
      })
    });
    
    // Admin tries to view senders (should only see their own, i.e., 0 senders)
    const adminSendersRes = await fetch(`${BASE_URL}/api/senders`, {
      headers: { Cookie: adminCookie.join('; ') }
    });
    
    const adminSendersData = await adminSendersRes.json();
    if (adminSendersData.length === 0) {
      console.log('✅ Passed: Platform admin cannot see normal user\'s senders. Isolation intact.');
    } else {
      console.log('❌ Failed: Platform admin can see another user\'s senders!');
    }

  } catch (error: any) {
    console.error('Test script error:', error.message);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTests();
