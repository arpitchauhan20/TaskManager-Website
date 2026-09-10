// ==========================================
// Google Calendar OAuth & Connection Automated Test Suite
// ==========================================
const http = require('http');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const authRoutes = require('../routes/authRoutes');
const calendarRoutes = require('../routes/calendarRoutes');
const googleCalendarService = require('../services/googleCalendar.service');
const userStorage = require('../services/storage/userStorage');
const { JWT_SECRET } = require('../middleware/authMiddleware');

const TEST_PORT = 9092;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Helper: HTTP Request with cookie tracking
function makeRequest(method, path, body = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method.toUpperCase(),
      headers: {}
    };

    if (body) {
      const data = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    if (cookie) {
      options.headers['Cookie'] = cookie;
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(responseBody);
        } catch {}

        let setCookie = res.headers['set-cookie'];
        if (Array.isArray(setCookie)) {
          setCookie = setCookie.map(c => c.split(';')[0]).join('; ');
        }

        resolve({
          status: res.statusCode,
          headers: res.headers,
          setCookie,
          body: json || responseBody
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

async function runCalendarTestSuite() {
  console.log('=========================================');
  console.log('🚀 Starting Google Calendar OAuth Test Suite...');
  console.log('=========================================\n');

  // Set test environment variables
  process.env.GOOGLE_CLIENT_ID = 'test_google_client_id.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'test_google_client_secret';
  process.env.GOOGLE_REDIRECT_URI = `${BASE_URL}/auth/google/callback`;

  // Spin up test server
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/', calendarRoutes);

  const server = app.listen(TEST_PORT);

  try {
    // 1. Unauthorized GET /auth/google
    const unauthOAuth = await makeRequest('GET', '/auth/google');
    assert(unauthOAuth.status === 401, 'Unauthorized GET /auth/google returns 401');
    assert(unauthOAuth.body && unauthOAuth.body.success === false, 'Unauthorized OAuth request returns success: false');

    // 2. Unauthorized GET /api/calendar/status
    const unauthStatus = await makeRequest('GET', '/api/calendar/status');
    assert(unauthStatus.status === 200, 'Unauthenticated GET /api/calendar/status returns 200');
    assert(unauthStatus.body && unauthStatus.body.connected === false, 'Unauthenticated status returns connected: false');

    // 3. Register and Login a fresh test user
    const testEmail = `gcal_test_${Date.now()}@example.com`;
    const regRes = await makeRequest('POST', '/api/auth/register', {
      name: 'Calendar Executive',
      email: testEmail,
      password: 'SecurePassword123!'
    });
    assert(regRes.status === 201, 'User registration succeeds with 201');
    const authCookie = regRes.setCookie;
    const userId = regRes.body.user.id;

    // 4. Check initial calendar status for new user
    const initialStatus = await makeRequest('GET', '/api/calendar/status', null, authCookie);
    assert(initialStatus.body && initialStatus.body.connected === false, 'New user starts with connected: false');

    // 5. Authenticated GET /auth/google generates redirect URL
    const authOAuth = await makeRequest('GET', '/auth/google', null, authCookie);
    assert(authOAuth.status === 302, 'Authenticated GET /auth/google returns 302 redirect');
    const redirectUrl = authOAuth.headers['location'];
    assert(redirectUrl && redirectUrl.includes('accounts.google.com'), 'Redirect location points to Google OAuth endpoint');
    assert(redirectUrl.includes('access_type=offline'), 'OAuth URL includes access_type=offline');
    assert(redirectUrl.includes('prompt=consent'), 'OAuth URL includes prompt=consent');
    assert(redirectUrl.includes('calendar.events'), 'OAuth URL requests calendar.events scope');

    // Extract state parameter
    const stateMatch = redirectUrl.match(/state=([^&]+)/);
    const oauthState = stateMatch ? decodeURIComponent(stateMatch[1]) : '';
    assert(oauthState.length > 0, 'OAuth URL includes signed state parameter');

    // 6. Test OAuth Callback
    // Mock exchangeCode to simulate Google's successful code exchange
    const originalExchangeCode = googleCalendarService.exchangeCode;
    googleCalendarService.exchangeCode = async (code) => {
      assert(code === 'valid_mock_code_123', 'exchangeCode received correct authorization code');
      return {
        tokens: {
          access_token: 'mock_access_token_abc',
          refresh_token: 'mock_refresh_token_xyz_999'
        },
        googleId: 'google_user_id_456',
        email: 'connected_google_account@gmail.com'
      };
    };

    // Callback with error parameter
    const errorCallback = await makeRequest('GET', '/auth/google/callback?error=access_denied', null, authCookie);
    assert(errorCallback.status === 302, 'Callback with error redirects');
    assert(errorCallback.headers['location'].includes('calendar_error=denied'), 'Callback handles denied permission gracefully');

    // Successful Callback
    const successCallback = await makeRequest(
      'GET',
      `/auth/google/callback?code=valid_mock_code_123&state=${encodeURIComponent(oauthState)}`,
      null,
      authCookie
    );
    assert(successCallback.status === 302, 'Successful callback returns 302 redirect');
    assert(successCallback.headers['location'].includes('calendar_connected=true'), 'Callback redirects to application with calendar_connected=true');

    // 7. Verify user record in storage
    const updatedUser = await userStorage.findById(userId);
    assert(
      updatedUser.google_calendar_connected === true || updatedUser.google_calendar_connected === 'true',
      'User storage marks google_calendar_connected as true'
    );
    assert(updatedUser.google_refresh_token.startsWith('enc:'), 'User refresh token is encrypted at rest');
    assert(googleCalendarService.decryptToken(updatedUser.google_refresh_token) === 'mock_refresh_token_xyz_999', 'User storage holds valid decryptable refresh token');
    assert(updatedUser.google_id === 'google_user_id_456', 'User storage associates Google account ID');

    // 8. Test GET /api/calendar/status when connected
    // Mock token validator to simulate active Google token
    const originalValidate = googleCalendarService.validateUserCalendarToken;
    googleCalendarService.validateUserCalendarToken = async (u) => {
      return { connected: true, accessToken: 'mock_valid_token' };
    };

    const connectedStatus = await makeRequest('GET', '/api/calendar/status', null, authCookie);
    assert(connectedStatus.status === 200, 'GET /api/calendar/status returns 200');
    assert(connectedStatus.body && connectedStatus.body.connected === true, 'GET /api/calendar/status returns { connected: true }');

    // 9. Test Revoked Authorization Graceful Handling
    googleCalendarService.validateUserCalendarToken = async (u) => {
      // Simulate Google returning invalid_grant error (token revoked by user on Google)
      await userStorage.updateUser(u.id, {
        google_calendar_connected: false,
        google_refresh_token: ''
      });
      return {
        connected: false,
        error: 'Google Calendar authorization has been revoked. Please reconnect.'
      };
    };

    const revokedStatus = await makeRequest('GET', '/api/calendar/status', null, authCookie);
    assert(revokedStatus.body && revokedStatus.body.connected === false, 'Revoked authorization returns { connected: false }');
    const userAfterRevocation = await userStorage.findById(userId);
    assert(
      !userAfterRevocation.google_calendar_connected || userAfterRevocation.google_calendar_connected === 'false',
      'Revoked token automatically marks user disconnected'
    );

    // Re-connect user for disconnect test
    await userStorage.updateUser(userId, {
      google_calendar_connected: true,
      google_refresh_token: 'mock_refresh_token_reconnected',
      google_id: 'google_user_id_456'
    });

    // 10. Test POST /api/calendar/disconnect
    let revokedCalled = false;
    googleCalendarService.revokeUserCalendar = async (u) => {
      revokedCalled = true;
      await userStorage.updateUser(u.id, {
        google_calendar_connected: false,
        google_refresh_token: '',
        google_id: ''
      });
      return { success: true };
    };

    const disconnectRes = await makeRequest('POST', '/api/calendar/disconnect', {}, authCookie);
    assert(disconnectRes.status === 200, 'POST /api/calendar/disconnect returns 200 OK');
    assert(disconnectRes.body && disconnectRes.body.success === true, 'Disconnect returns success: true');
    assert(revokedCalled === true, 'Disconnect invokes token revocation');

    // Verify user after disconnect
    const userAfterDisconnect = await userStorage.findById(userId);
    assert(
      !userAfterDisconnect.google_calendar_connected || userAfterDisconnect.google_calendar_connected === 'false',
      'Disconnect marks google_calendar_connected as false'
    );
    assert(!userAfterDisconnect.google_refresh_token, 'Disconnect clears stored refresh token');
    assert(userAfterDisconnect.email === testEmail, 'Disconnect preserves user email');
    assert(userAfterDisconnect.password_hash.length > 0, 'Disconnect preserves user password hash');

    // 11. Final Status Check
    googleCalendarService.validateUserCalendarToken = originalValidate;
    googleCalendarService.exchangeCode = originalExchangeCode;

    const finalStatus = await makeRequest('GET', '/api/calendar/status', null, authCookie);
    assert(finalStatus.body && finalStatus.body.connected === false, 'Final status confirms { connected: false }');

    console.log('\n=========================================');
    console.log('🎉 ALL 11 GOOGLE CALENDAR TESTS PASSED!');
    console.log('=========================================\n');
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    server.close();
  }
}

runCalendarTestSuite();
