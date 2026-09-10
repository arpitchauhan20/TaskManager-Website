// =============================================================
// TaskFlow Pro — Comprehensive Authentication Test Suite
// =============================================================
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-12345';

const http = require('http');
const express = require('express');
const cookieParser = require('cookie-parser');
const authRoutes = require('../routes/authRoutes');
const userStorage = require('../services/storage/userStorage');

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use('/api/auth', authRoutes);

let server;
let port;
let baseUrl;

function makeRequest(method, path, body = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = {
      'Content-Type': 'application/json',
      'x-test-bypass-rate-limit': '1'
    };
    if (cookie) {
      headers['Cookie'] = cookie;
    }

    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(url, { method, headers }, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }

        const setCookieHeader = res.headers['set-cookie'];
        let authCookie = null;
        if (setCookieHeader) {
          const match = setCookieHeader.find(c => c.startsWith('auth_token='));
          if (match) {
            authCookie = match.split(';')[0];
          }
        }

        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json,
          authCookie
        });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function assert(condition, testName) {
  if (!condition) {
    console.error(`❌ FAIL: ${testName}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${testName}`);
  }
}

async function runTests() {
  console.log('\n=========================================');
  console.log('🚀 Starting Authentication Test Suite...');
  console.log('=========================================\n');

  await new Promise(resolve => {
    server = app.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  const testEmail = `testuser_${Date.now()}@example.com`;
  const testPassword = 'StrongPassword123!';
  const testName = 'John Tester';

  let activeCookie = null;

  try {
    // 1. Unauthorized request
    const unauthRes = await makeRequest('GET', '/api/auth/me');
    assert(unauthRes.status === 401, 'Unauthorized request without cookie returns 401');

    // 2. Registration
    const regRes = await makeRequest('POST', '/api/auth/register', {
      name: testName,
      email: testEmail,
      password: testPassword
    });
    assert(regRes.status === 201, 'Registration returns 201 Created');
    assert(regRes.body.success === true, 'Registration returns success: true');
    assert(regRes.body.user && regRes.body.user.email === testEmail, 'User email matches registered email');
    assert(!regRes.body.user.password_hash, 'Password hash is NOT exposed in response');
    assert(!!regRes.authCookie, 'Registration sets auth_token cookie');
    activeCookie = regRes.authCookie;

    // 3. Duplicate email registration
    const dupRes = await makeRequest('POST', '/api/auth/register', {
      name: 'Duplicate',
      email: testEmail,
      password: 'AnotherPassword123!'
    });
    assert(dupRes.status === 409, 'Duplicate email registration returns 409 Conflict');

    // 4. Current user (/me) with valid session
    const meRes = await makeRequest('GET', '/api/auth/me', null, activeCookie);
    assert(meRes.status === 200, 'GET /api/auth/me returns 200');
    assert(meRes.body.user.name === testName, 'GET /api/auth/me returns correct user name');
    assert(!meRes.body.user.password_hash, 'GET /api/auth/me does not expose password_hash');

    // 5. Logout
    const logoutRes = await makeRequest('POST', '/api/auth/logout', null, activeCookie);
    assert(logoutRes.status === 200, 'Logout returns 200 OK');

    // 6. Invalid login (wrong password)
    const badLoginRes = await makeRequest('POST', '/api/auth/login', {
      email: testEmail,
      password: 'WrongPassword999!'
    });
    assert(badLoginRes.status === 401, 'Invalid login password returns 401');
    assert(badLoginRes.body.error === 'Invalid email or password.', 'Returns generic error message for invalid login');

    // 7. Invalid login (non-existent email)
    const noUserLogin = await makeRequest('POST', '/api/auth/login', {
      email: 'nonexistent_user@example.com',
      password: 'SomePassword123!'
    });
    assert(noUserLogin.status === 401, 'Non-existent user login returns 401');
    assert(noUserLogin.body.error === 'Invalid email or password.', 'Generic error hides whether email exists');

    // 8. Successful Login
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: testEmail,
      password: testPassword
    });
    assert(loginRes.status === 200, 'Login with correct credentials returns 200');
    assert(!!loginRes.authCookie, 'Login sets auth_token cookie');
    activeCookie = loginRes.authCookie;

    // 9. Change Password
    const changePwRes = await makeRequest(
      'PUT',
      '/api/auth/password',
      {
        currentPassword: testPassword,
        newPassword: 'NewStrongPassword456!'
      },
      activeCookie
    );
    assert(changePwRes.status === 200, 'Change password returns 200');

    // Verify old password no longer works
    const oldPwLogin = await makeRequest('POST', '/api/auth/login', {
      email: testEmail,
      password: testPassword
    });
    assert(oldPwLogin.status === 401, 'Old password fails after password change');

    // Verify new password works
    const newPwLogin = await makeRequest('POST', '/api/auth/login', {
      email: testEmail,
      password: 'NewStrongPassword456!'
    });
    assert(newPwLogin.status === 200, 'New password successfully authenticates');
    activeCookie = newPwLogin.authCookie;

    // 10. Forgot Password
    const forgotRes = await makeRequest('POST', '/api/auth/forgot-password', {
      email: testEmail
    });
    assert(forgotRes.status === 200, 'Forgot password returns 200');
    assert(
      forgotRes.body.message === 'If an account with that email exists, a password reset link has been sent.',
      'Forgot password returns generic message'
    );

    // Verify reset token was written to storage
    const userInStorage = await userStorage.findByEmail(testEmail);
    assert(!!userInStorage.reset_token_hash, 'Reset token hash is stored in storage');
    assert(!!userInStorage.reset_token_expires_at, 'Reset token expiration is stored in storage');

    // 11. Test Expired Reset Token
    // Simulate expired token
    await userStorage.updateUser(userInStorage.id, {
      reset_token_expires_at: new Date(Date.now() - 1000).toISOString()
    });
    const expiredResetRes = await makeRequest('POST', '/api/auth/reset-password', {
      token: 'some_dummy_token',
      newPassword: 'BrandNewPassword789!'
    });
    assert(expiredResetRes.status === 400, 'Expired or invalid reset token returns 400');

    // 12. Successful Password Reset with valid token
    const rawToken = 'valid_secret_reset_token_12345';
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await userStorage.updateUser(userInStorage.id, {
      reset_token_hash: tokenHash,
      reset_token_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    });

    const validResetRes = await makeRequest('POST', '/api/auth/reset-password', {
      token: rawToken,
      newPassword: 'BrandNewPassword789!'
    });
    assert(validResetRes.status === 200, 'Password reset with valid token returns 200');

    // 13. Test Single-Use (Used Reset Token)
    const usedTokenRes = await makeRequest('POST', '/api/auth/reset-password', {
      token: rawToken,
      newPassword: 'AnotherPassword999!'
    });
    assert(usedTokenRes.status === 400, 'Re-using already consumed reset token returns 400');

    // 14. Verify login with reset password
    const afterResetLogin = await makeRequest('POST', '/api/auth/login', {
      email: testEmail,
      password: 'BrandNewPassword789!'
    });
    assert(afterResetLogin.status === 200, 'Login with newly reset password succeeds');

    console.log('\n=========================================');
    console.log('🎉 ALL 14 AUTHENTICATION TESTS PASSED!');
    console.log('=========================================\n');
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    server.close();
  }
}

runTests();
