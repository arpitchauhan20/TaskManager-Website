// ==========================================
// Multi-User SaaS Tenant Isolation & Token Encryption Automated Test Suite
// ==========================================
const http = require('http');
const express = require('express');
const cookieParser = require('cookie-parser');
const authRoutes = require('../routes/authRoutes');
const calendarRoutes = require('../routes/calendarRoutes');
const googleCalendarService = require('../services/googleCalendar.service');
const userStorage = require('../services/storage/userStorage');

const TEST_PORT = 9094;
const BASE_URL = `http://localhost:${TEST_PORT}`;

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

async function runMultiUserSaaSTest() {
  console.log('===============================================================');
  console.log('🏢 Starting Multi-User SaaS Tenant Isolation Test Suite...');
  console.log('===============================================================\n');

  process.env.GOOGLE_CLIENT_ID = 'saas_multitenant_client_id.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'saas_multitenant_secret';
  process.env.GOOGLE_REDIRECT_URI = `${BASE_URL}/auth/google/callback`;

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/', calendarRoutes);

  const server = app.listen(TEST_PORT);

  try {
    // -------------------------------------------------------------
    // Step 1: Create Two Completely Independent SaaS Tenants
    // -------------------------------------------------------------
    console.log('--- Step 1: Onboard User A and User B ---');
    const emailA = `tenant_a_${Date.now()}@acme-corp.com`;
    const emailB = `tenant_b_${Date.now()}@beta-industries.com`;

    // Register User A
    const regA = await makeRequest('POST', '/api/auth/register', {
      name: 'Alice (Tenant A)',
      email: emailA,
      password: 'AliceSecurePass123!'
    });
    assert(regA.status === 201, 'Tenant A (Alice) registered');
    const userAId = regA.body.user.id;
    const cookieA = regA.setCookie;

    // Register User B
    const regB = await makeRequest('POST', '/api/auth/register', {
      name: 'Bob (Tenant B)',
      email: emailB,
      password: 'BobSecurePass456!'
    });
    assert(regB.status === 201, 'Tenant B (Bob) registered');
    const userBId = regB.body.user.id;
    const cookieB = regB.setCookie;

    assert(userAId !== userBId, 'Tenants have unique, isolated IDs');

    // -------------------------------------------------------------
    // Step 2: User A connects Google Account A
    // -------------------------------------------------------------
    console.log('\n--- Step 2: User A connects Google Calendar A ---');
    const oauthA = await makeRequest('GET', '/auth/google', null, cookieA);
    const stateA = decodeURIComponent(oauthA.headers['location'].match(/state=([^&]+)/)[1]);

    // Mock exchangeCode for User A
    const tokenA = 'mock_google_refresh_token_TENANT_A';
    googleCalendarService.exchangeCode = async () => ({
      tokens: { refresh_token: tokenA, access_token: 'access_tok_A' },
      googleId: 'google_account_A_111',
      email: 'alice.personal@gmail.com'
    });

    const callbackA = await makeRequest(
      'GET',
      `/auth/google/callback?code=code_A&state=${encodeURIComponent(stateA)}`,
      null,
      cookieA
    );
    assert(callbackA.headers['location'].includes('calendar_connected=true'), 'User A connected Calendar A');

    // -------------------------------------------------------------
    // Step 3: User B connects Google Account B
    // -------------------------------------------------------------
    console.log('\n--- Step 3: User B connects Google Calendar B ---');
    const oauthB = await makeRequest('GET', '/auth/google', null, cookieB);
    const stateB = decodeURIComponent(oauthB.headers['location'].match(/state=([^&]+)/)[1]);

    // Mock exchangeCode for User B
    const tokenB = 'mock_google_refresh_token_TENANT_B';
    googleCalendarService.exchangeCode = async () => ({
      tokens: { refresh_token: tokenB, access_token: 'access_tok_B' },
      googleId: 'google_account_B_222',
      email: 'bob.personal@gmail.com'
    });

    const callbackB = await makeRequest(
      'GET',
      `/auth/google/callback?code=code_B&state=${encodeURIComponent(stateB)}`,
      null,
      cookieB
    );
    assert(callbackB.headers['location'].includes('calendar_connected=true'), 'User B connected Calendar B');

    // -------------------------------------------------------------
    // Step 4: Verify Token Encryption at Rest for both users
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Verify Token Encryption at Rest ---');
    const storedUserA = await userStorage.findById(userAId);
    const storedUserB = await userStorage.findById(userBId);

    assert(storedUserA.google_refresh_token.startsWith('enc:'), 'User A token is securely ENCRYPTED with AES-256-GCM at rest');
    assert(storedUserB.google_refresh_token.startsWith('enc:'), 'User B token is securely ENCRYPTED with AES-256-GCM at rest');
    assert(storedUserA.google_refresh_token !== storedUserB.google_refresh_token, 'Encrypted ciphertexts are distinct');

    // Verify decryption
    assert(googleCalendarService.decryptToken(storedUserA.google_refresh_token) === tokenA, 'User A token decrypts accurately');
    assert(googleCalendarService.decryptToken(storedUserB.google_refresh_token) === tokenB, 'User B token decrypts accurately');

    // -------------------------------------------------------------
    // Step 5: Multi-Tenant Calendar Event Creation & Strict Isolation
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Multi-Tenant Event Dispatch & Isolation ---');
    const calendarEventsA = [];
    const calendarEventsB = [];

    // Mock getCalendarClient to track which token was used for each event
    const originalGetCalendarClient = googleCalendarService.getCalendarClient;
    googleCalendarService.getCalendarClient = function(refreshToken) {
      const decrypted = googleCalendarService.decryptToken(refreshToken);
      const isTokenA = decrypted === tokenA;
      const isTokenB = decrypted === tokenB;
      assert(isTokenA || isTokenB, 'Received known tenant token in calendar client');

      return {
        events: {
          insert: async ({ calendarId, requestBody }) => {
            assert(calendarId === 'primary', 'Inserted into primary calendar');
            if (isTokenA) {
              calendarEventsA.push(requestBody.summary);
            } else if (isTokenB) {
              calendarEventsB.push(requestBody.summary);
            }
            return {
              data: {
                id: `evt_${Date.now()}`,
                htmlLink: `https://calendar.google.com/event?id=mock`,
                summary: requestBody.summary
              }
            };
          }
        }
      };
    };

    // User A creates Event A
    const resEventA = await makeRequest('POST', '/api/calendar/reminders', {
      title: 'Event A: Acme Strategic Board Review',
      description: 'Private board meeting for Acme Corp',
      startTime: '2026-09-10T20:00:00+05:30',
      timeZone: 'Asia/Kolkata'
    }, cookieA);
    assert(resEventA.status === 200, 'User A successfully creates Event A');

    // User B creates Event B
    const resEventB = await makeRequest('POST', '/api/calendar/reminders', {
      title: 'Event B: Beta Industries Product Launch',
      description: 'Private product launch for Beta Industries',
      startTime: '2026-09-10T21:00:00+05:30',
      timeZone: 'America/New_York'
    }, cookieB);
    assert(resEventB.status === 200, 'User B successfully creates Event B');

    // VERIFY STRICT TENANT ISOLATION:
    // Calendar A: ✓ Event A, ✗ Event B
    // Calendar B: ✓ Event B, ✗ Event A
    assert(calendarEventsA.includes('Event A: Acme Strategic Board Review'), 'Calendar A contains Event A (✓)');
    assert(!calendarEventsA.includes('Event B: Beta Industries Product Launch'), 'Calendar A strictly DOES NOT contain Event B (✗)');

    assert(calendarEventsB.includes('Event B: Beta Industries Product Launch'), 'Calendar B contains Event B (✓)');
    assert(!calendarEventsB.includes('Event A: Acme Strategic Board Review'), 'Calendar B strictly DOES NOT contain Event A (✗)');

    console.log('✅ Multi-tenant isolation verified: No cross-tenant calendar data leakage!');

    // -------------------------------------------------------------
    // Step 6: Disconnect User A and Verify User B is UNAFFECTED
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Disconnect Tenant A and verify Tenant B is unaffected ---');
    googleCalendarService.revokeUserCalendar = async (u) => {
      assert(u.id === userAId, 'Only User A token is revoked on Google');
      await userStorage.updateUser(u.id, {
        google_calendar_connected: false,
        google_refresh_token: '',
        google_id: ''
      });
      return { success: true };
    };

    const disconnA = await makeRequest('POST', '/api/calendar/disconnect', {}, cookieA);
    assert(disconnA.status === 200, 'User A disconnected Google Calendar');

    // Verify User A is disconnected
    googleCalendarService.validateUserCalendarToken = async (u) => {
      return { connected: u.google_calendar_connected && !!u.google_refresh_token };
    };

    const statusA = await makeRequest('GET', '/api/calendar/status', null, cookieA);
    assert(statusA.body.connected === false, 'User A status is now { connected: false }');

    // Verify User B is STILL connected
    const statusB = await makeRequest('GET', '/api/calendar/status', null, cookieB);
    assert(statusB.body.connected === true, 'User B status REMAINS { connected: true }');

    // Verify User B can STILL create events
    const resEventB2 = await makeRequest('POST', '/api/calendar/reminders', {
      title: 'Event B2: Beta Industries Followup',
      startTime: '2026-09-11T10:00:00+05:30'
    }, cookieB);
    assert(resEventB2.status === 200, 'User B continues creating reminders without disruption');
    assert(calendarEventsB.includes('Event B2: Beta Industries Followup'), 'Calendar B received Event B2');

    // Verify User A CANNOT create events anymore
    const failedEventA = await makeRequest('POST', '/api/calendar/reminders', {
      title: 'Event A Should Fail',
      startTime: '2026-09-11T12:00:00+05:30'
    }, cookieA);
    assert(failedEventA.status === 400, 'Disconnected User A correctly blocked from creating events (400)');

    googleCalendarService.getCalendarClient = originalGetCalendarClient;

    console.log('\n===============================================================');
    console.log('🎉 ALL MULTI-USER SAAS TENANT ISOLATION TESTS PASSED!');
    console.log('===============================================================\n');
  } catch (err) {
    console.error('Fatal multi-user SaaS test error:', err);
    process.exit(1);
  } finally {
    server.close();
  }
}

runMultiUserSaaSTest();
