// ==========================================
// Complete End-to-End Flow & Reminder Creation Automated Test Suite
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

const TEST_PORT = 9093;
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

async function runFullFlowTestSuite() {
  console.log('=========================================');
  console.log('🚀 Running Complete End-to-End Test Suite...');
  console.log('=========================================\n');

  process.env.GOOGLE_CLIENT_ID = 'test_client_id.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'test_client_secret';
  process.env.GOOGLE_REDIRECT_URI = `${BASE_URL}/auth/google/callback`;

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/', calendarRoutes);

  const server = app.listen(TEST_PORT);

  try {
    // -------------------------------------------------------------
    // 1. REGISTER
    // -------------------------------------------------------------
    const testEmail = `executive_${Date.now()}@example.com`;
    const initialPassword = 'InitialPassword123!';
    const newPassword = 'NewSecretPassword456!';

    console.log('--- Step 1: Register ---');
    const regRes = await makeRequest('POST', '/api/auth/register', {
      name: 'Full Flow Tester',
      email: testEmail,
      password: initialPassword
    });
    assert(regRes.status === 201, 'User registers successfully (201 Created)');
    const userId = regRes.body.user.id;
    let authCookie = regRes.setCookie;

    // -------------------------------------------------------------
    // 2. LOGIN
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Login ---');
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: testEmail,
      password: initialPassword
    });
    assert(loginRes.status === 200, 'User logs in successfully (200 OK)');
    authCookie = loginRes.setCookie;

    // -------------------------------------------------------------
    // 3. FORGOT PASSWORD
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Forgot Password ---');
    const forgotRes = await makeRequest('POST', '/api/auth/forgot-password', {
      email: testEmail
    });
    assert(forgotRes.status === 200, 'Forgot password returns 200 OK');

    const userWithToken = await userStorage.findById(userId);
    const tokenHash = userWithToken.reset_token_hash;
    assert(tokenHash && tokenHash.length === 64, 'Password reset token hash stored in storage');

    // -------------------------------------------------------------
    // 4. RESET PASSWORD
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Reset Password ---');
    // Inject a known token
    const crypto = require('crypto');
    const rawResetToken = 'test_raw_reset_token_' + Date.now();
    const rawHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');
    await userStorage.updateUser(userId, {
      reset_token_hash: rawHash,
      reset_token_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    });

    const resetRes = await makeRequest('POST', '/api/auth/reset-password', {
      token: rawResetToken,
      newPassword: newPassword
    });
    assert(resetRes.status === 200, 'Password reset succeeds with valid token (200 OK)');

    // -------------------------------------------------------------
    // 5. RE-LOGIN WITH NEW PASSWORD
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Login with New Password ---');
    const reLoginRes = await makeRequest('POST', '/api/auth/login', {
      email: testEmail,
      password: newPassword
    });
    assert(reLoginRes.status === 200, 'Login with new password succeeds');
    authCookie = reLoginRes.setCookie;

    // -------------------------------------------------------------
    // 6. TEST UNAUTHORIZED REMINDER REQUEST
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Unauthorized Reminder Creation ---');
    const unauthReminder = await makeRequest('POST', '/api/calendar/reminders', {
      title: 'Team Meeting',
      startTime: '2026-09-10T20:00:00+05:30'
    });
    assert(unauthReminder.status === 401, 'Unauthenticated reminder creation rejected with 401');

    // -------------------------------------------------------------
    // 7. TEST UNCONNECTED CALENDAR REQUEST
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Reminder Creation when Calendar Not Connected ---');
    const unconnectedReminder = await makeRequest('POST', '/api/calendar/reminders', {
      title: 'Team Meeting',
      startTime: '2026-09-10T20:00:00+05:30'
    }, authCookie);
    assert(unconnectedReminder.status === 400, 'Reminder creation rejected with 400 when calendar is disconnected');
    assert(unconnectedReminder.body.error.includes("Google Calendar isn't connected"), 'Helpful error message returned');

    // -------------------------------------------------------------
    // 8. CONNECT GOOGLE CALENDAR
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Connect Google Calendar (OAuth) ---');
    const oauthRes = await makeRequest('GET', '/auth/google', null, authCookie);
    assert(oauthRes.status === 302, 'GET /auth/google redirects to Google consent (302)');

    const location = oauthRes.headers['location'];
    const state = decodeURIComponent(location.match(/state=([^&]+)/)[1]);

    // Mock exchangeCode
    googleCalendarService.exchangeCode = async (code) => {
      return {
        tokens: {
          access_token: 'mock_gcal_access_token',
          refresh_token: 'mock_gcal_refresh_token_final'
        },
        googleId: 'google_id_777',
        email: testEmail
      };
    };

    const callbackRes = await makeRequest(
      'GET',
      `/auth/google/callback?code=mock_oauth_code&state=${encodeURIComponent(state)}`,
      null,
      authCookie
    );
    assert(callbackRes.status === 302, 'Callback redirects with 302');
    assert(callbackRes.headers['location'].includes('calendar_connected=true'), 'Callback redirects to app with calendar_connected=true');

    // Verify status is now connected
    googleCalendarService.validateUserCalendarToken = async () => ({ connected: true, accessToken: 'mock_tok' });
    const statusRes = await makeRequest('GET', '/api/calendar/status', null, authCookie);
    assert(statusRes.body && statusRes.body.connected === true, 'Calendar status is now { connected: true }');

    // -------------------------------------------------------------
    // 9. TEST INPUT VALIDATIONS
    // -------------------------------------------------------------
    console.log('\n--- Step 9: Input Validations ---');
    // Missing title
    const emptyTitleRes = await makeRequest('POST', '/api/calendar/reminders', {
      title: '',
      startTime: '2026-09-10T20:00:00+05:30'
    }, authCookie);
    assert(emptyTitleRes.status === 400, 'Empty title rejected with 400');

    // Invalid startTime
    const invalidDateRes = await makeRequest('POST', '/api/calendar/reminders', {
      title: 'Valid Title',
      startTime: 'not-a-valid-date'
    }, authCookie);
    assert(invalidDateRes.status === 400, 'Invalid startTime date string rejected with 400');

    // endTime before startTime
    const invalidEndRes = await makeRequest('POST', '/api/calendar/reminders', {
      title: 'Valid Title',
      startTime: '2026-09-10T20:00:00+05:30',
      endTime: '2026-09-10T19:00:00+05:30'
    }, authCookie);
    assert(invalidEndRes.status === 400, 'endTime before startTime rejected with 400');

    // Invalid timezone
    const invalidTzRes = await makeRequest('POST', '/api/calendar/reminders', {
      title: 'Valid Title',
      startTime: '2026-09-10T20:00:00+05:30',
      timeZone: 'Invalid/NonExistent_Zone'
    }, authCookie);
    assert(invalidTzRes.status === 400, 'Invalid IANA timezone rejected with 400');

    // Negative reminderMinutes
    const invalidMinRes = await makeRequest('POST', '/api/calendar/reminders', {
      title: 'Valid Title',
      startTime: '2026-09-10T20:00:00+05:30',
      reminderMinutes: -15
    }, authCookie);
    assert(invalidMinRes.status === 400, 'Negative reminderMinutes rejected with 400');

    // -------------------------------------------------------------
    // 10. TEST SUCCESSFUL CALENDAR EVENT INSERTION
    // -------------------------------------------------------------
    console.log('\n--- Step 10: Successful Google Calendar Event Creation ---');
    let capturedPayload = null;
    let capturedCalendarId = null;

    // Mock getCalendarClient so no real Google network call is executed in automated test
    const originalGetCalendarClient = googleCalendarService.getCalendarClient;
    googleCalendarService.getCalendarClient = function(refreshToken) {
      const decrypted = googleCalendarService.decryptToken(refreshToken);
      assert(decrypted === 'mock_gcal_refresh_token_final', 'Correct refresh token passed to Google Calendar client');
      return {
        events: {
          insert: async ({ calendarId, requestBody }) => {
            capturedCalendarId = calendarId;
            capturedPayload = requestBody;
            return {
              data: {
                id: 'mock_gcal_event_id_888',
                htmlLink: 'https://calendar.google.com/calendar/event?eid=mock_gcal_event_id_888',
                summary: requestBody.summary,
                start: requestBody.start,
                end: requestBody.end
              }
            };
          }
        }
      };
    };

    const reminderPayload = {
      title: 'Team Meeting',
      description: 'Weekly team meeting',
      startTime: '2026-09-10T20:00:00+05:30',
      endTime: '2026-09-10T21:00:00+05:30',
      reminderMinutes: 10,
      timeZone: 'Asia/Kolkata'
    };

    const createRes = await makeRequest('POST', '/api/calendar/reminders', reminderPayload, authCookie);
    assert(createRes.status === 200, 'POST /api/calendar/reminders returns 200 OK');
    assert(createRes.body.success === true, 'Response indicates success: true');
    assert(createRes.body.message === 'Reminder added to Google Calendar.', 'Response contains confirmation message');
    assert(createRes.body.event && createRes.body.event.id === 'mock_gcal_event_id_888', 'Event ID returned in response');
    assert(createRes.body.event.htmlLink.includes('calendar.google.com'), 'Event htmlLink returned for user convenience');

    // Verify Google Calendar API call parameters
    assert(capturedCalendarId === 'primary', 'Event was inserted into "primary" Google Calendar');
    assert(capturedPayload.summary === 'Team Meeting', 'Event summary matches title');
    assert(capturedPayload.description === 'Weekly team meeting', 'Event description matches');
    assert(capturedPayload.start.timeZone === 'Asia/Kolkata', 'Start timezone correctly set to Asia/Kolkata');
    assert(capturedPayload.reminders.useDefault === false, 'Event disabled default reminders');
    assert(capturedPayload.reminders.overrides[0].method === 'popup', 'Event reminder method is popup');
    assert(capturedPayload.reminders.overrides[0].minutes === 10, 'Event reminder minutes set to 10');

    // -------------------------------------------------------------
    // 11. VERIFY ZERO APPLICATION REMINDER STORAGE
    // -------------------------------------------------------------
    console.log('\n--- Step 11: Verify Zero Application Reminder Storage ---');
    const currentUserInStorage = await userStorage.findById(userId);
    assert(currentUserInStorage.reminders === undefined, 'No reminders field exists in user storage');
    assert(currentUserInStorage.events === undefined, 'No events field exists in user storage');
    const userKeys = Object.keys(currentUserInStorage);
    const hasReminderKey = userKeys.some(k => k.toLowerCase().includes('reminder') && !k.includes('reset'));
    assert(!hasReminderKey, 'Application user storage strictly does not store reminder objects');

    // -------------------------------------------------------------
    // 12. TEST REVOKED GOOGLE AUTHORIZATION
    // -------------------------------------------------------------
    console.log('\n--- Step 12: Revoked Authorization Graceful Handling ---');
    googleCalendarService.getCalendarClient = function() {
      return {
        events: {
          insert: async () => {
            const err = new Error('invalid_grant: Token has been expired or revoked.');
            err.code = 401;
            throw err;
          }
        }
      };
    };

    const revokedAttempt = await makeRequest('POST', '/api/calendar/reminders', reminderPayload, authCookie);
    assert(revokedAttempt.status === 401, 'Revoked Google token returns 401 status');
    assert(revokedAttempt.body.error.includes('expired or revoked'), 'Informs user that authorization expired/revoked');

    const userAfterRevocation = await userStorage.findById(userId);
    assert(
      !userAfterRevocation.google_calendar_connected || userAfterRevocation.google_calendar_connected === 'false',
      'User is automatically marked disconnected after revocation'
    );

    googleCalendarService.getCalendarClient = originalGetCalendarClient;

    console.log('\n=========================================');
    console.log('🎉 ALL 12 FULL-FLOW & REMINDER TESTS PASSED!');
    console.log('=========================================\n');
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    server.close();
  }
}

runFullFlowTestSuite();
