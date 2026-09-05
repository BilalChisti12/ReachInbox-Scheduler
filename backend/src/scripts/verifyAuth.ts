import request from 'supertest';
import app from '../app';

async function verifyAuth() {
  console.log('--- Verifying Authentication Endpoints ---');
  let hasErrors = false;

  // 1. Unauthenticated /auth/me
  try {
    const res = await request(app).get('/auth/me');
    if (res.status === 401 && res.body.authenticated === false) {
      console.log('✅ Unauthenticated GET /auth/me returns 401 correctly.');
    } else {
      throw new Error(`Unexpected status ${res.status}`);
    }
  } catch (error) {
    console.error('❌ Unauthenticated GET /auth/me check failed:', error);
    hasErrors = true;
  }

  // 2. Unauthenticated /api/protected-test
  try {
    const res = await request(app).get('/api/protected-test');
    if (res.status === 401 && res.body.error === 'Unauthorized: You must be logged in to access this resource.') {
      console.log('✅ Unauthenticated GET /api/protected-test blocked by requireAuth middleware.');
    } else {
      throw new Error(`Unexpected status ${res.status}`);
    }
  } catch (error) {
    console.error('❌ Unauthenticated GET /api/protected-test check failed:', error);
    hasErrors = true;
  }

  // 3. /auth/logout (should clear session)
  try {
    const res = await request(app).post('/auth/logout');
    if (res.status === 200 && res.body.success === true) {
      console.log('✅ POST /auth/logout destroys session correctly.');
    } else {
      throw new Error(`Unexpected status ${res.status}`);
    }
  } catch (error) {
    console.error('❌ POST /auth/logout check failed:', error);
    hasErrors = true;
  }

  // 4. OAuth redirect verification
  try {
    const res = await request(app).get('/auth/google');
    if (res.status === 302 && res.header.location.includes('accounts.google.com/o/oauth2/v2/auth')) {
      console.log('✅ GET /auth/google successfully initiates OAuth 2.0 flow redirection.');
    } else {
      throw new Error(`Unexpected status ${res.status} or location header`);
    }
  } catch (error) {
    console.error('❌ GET /auth/google check failed:', error);
    hasErrors = true;
  }

  if (hasErrors) {
    process.exit(1);
  } else {
    console.log('\n✅ All authentication verifications passed successfully.');
    process.exit(0);
  }
}

verifyAuth();
