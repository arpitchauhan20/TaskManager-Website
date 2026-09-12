// ==========================================
// Google Calendar OAuth & Connection Routes
// ==========================================
const express = require('express');
const jwt = require('jsonwebtoken');
const googleCalendarService = require('../services/googleCalendar.service');
const userStorage = require('../services/storage/userStorage');
const { authMiddleware, JWT_SECRET } = require('../middleware/authMiddleware');

const router = express.Router();

// Helper to resolve authenticated user from cookies, header, or query token
async function resolveUserFromRequest(req) {
  let token = null;

  if (req.cookies && req.cookies.auth_token) {
    token = req.cookies.auth_token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.id) return null;
    return await userStorage.findById(decoded.id);
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// 1. START GOOGLE OAUTH FLOW
// GET /auth/google
// -------------------------------------------------------------
router.get(['/auth/google', '/api/calendar/auth'], async (req, res) => {
  try {
    const user = await resolveUserFromRequest(req);

    if (!user) {
      return res.redirect('/?calendar_error=login_required');
    }

    // Embed signed userId in state token to prevent CSRF and correlate callback
    const state = jwt.sign(
      { userId: user.id, action: 'connect_calendar' },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const authUrl = googleCalendarService.generateAuthUrl(state, req);
    return res.redirect(authUrl);
  } catch (err) {
    console.error('[CalendarRoutes] Error initiating Google OAuth:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to initiate Google Calendar authorization.'
    });
  }
});

// -------------------------------------------------------------
// 2. GOOGLE OAUTH CALLBACK
// GET /auth/google/callback
// -------------------------------------------------------------
router.get(['/auth/google/callback', '/api/calendar/callback'], async (req, res) => {
  const { code, state, error: googleError } = req.query;

  if (googleError) {
    console.warn('[CalendarRoutes] Google OAuth callback returned error:', googleError);
    return res.redirect('/?calendar_error=denied');
  }

  if (!code) {
    return res.redirect('/?calendar_error=missing_code');
  }

  try {
    // 1. Correlate with current application user
    let targetUserId = null;

    if (state) {
      try {
        const decodedState = jwt.verify(state, JWT_SECRET);
        targetUserId = decodedState?.userId;
      } catch (e) {
        console.warn('[CalendarRoutes] Invalid OAuth state token:', e.message);
      }
    }

    if (!targetUserId) {
      const activeUser = await resolveUserFromRequest(req);
      targetUserId = activeUser?.id;
    }

    if (!targetUserId) {
      return res.redirect('/?calendar_error=unauthorized');
    }

    const user = await userStorage.findById(targetUserId);
    if (!user) {
      return res.redirect('/?calendar_error=user_not_found');
    }

    // 2. Exchange authorization code for Google credentials
    const { tokens, googleId, email } = await googleCalendarService.exchangeCode(code, req);

    // 3. Store required authorization information securely
    const updates = {
      google_calendar_connected: true
    };

    if (tokens.refresh_token) {
      updates.google_refresh_token = googleCalendarService.encryptToken(tokens.refresh_token);
    }
    if (googleId) {
      updates.google_id = googleId;
    }

    await userStorage.updateUser(user.id, updates);

    console.log(`[CalendarRoutes] Google Calendar successfully connected for user ${user.id} (${email || googleId})`);

    // 4. Redirect user back to application
    return res.redirect('/?calendar_connected=true');
  } catch (err) {
    console.error('[CalendarRoutes] Error handling Google OAuth callback:', err);
    return res.redirect('/?calendar_error=exchange_failed');
  }
});

// -------------------------------------------------------------
// 3. CALENDAR STATUS
// GET /api/calendar/status or /status
// -------------------------------------------------------------
router.get(['/api/calendar/status', '/status'], async (req, res) => {
  try {
    const user = await resolveUserFromRequest(req);

    if (!user) {
      return res.status(200).json({ connected: false });
    }

    const isMarkedConnected = Boolean(
      user.google_calendar_connected === true ||
      user.google_calendar_connected === 'true'
    );

    if (!isMarkedConnected || !user.google_refresh_token) {
      return res.status(200).json({ connected: false });
    }

    // Verify token validity with Google
    const tokenCheck = await googleCalendarService.validateUserCalendarToken(user);
    if (!tokenCheck.connected) {
      return res.status(200).json({
        connected: false,
        error: tokenCheck.error || 'Google Calendar disconnected. Please reconnect.'
      });
    }

    return res.status(200).json({
      connected: true
    });
  } catch (err) {
    console.error('[CalendarRoutes] Error checking calendar status:', err);
    return res.status(200).json({ connected: false });
  }
});

// -------------------------------------------------------------
// 4. DISCONNECT CALENDAR
// POST /api/calendar/disconnect or /disconnect
// -------------------------------------------------------------
router.post(['/api/calendar/disconnect', '/disconnect'], authMiddleware, async (req, res) => {
  try {
    const user = await userStorage.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    // Revoke Google authorization and clear refresh token without deleting user
    await googleCalendarService.revokeUserCalendar(user);

    return res.status(200).json({
      success: true,
      message: 'Google Calendar disconnected successfully.'
    });
  } catch (err) {
    console.error('[CalendarRoutes] Error disconnecting calendar:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to disconnect Google Calendar.'
    });
  }
});

// -------------------------------------------------------------
// 5. CREATE GOOGLE CALENDAR REMINDER EVENT
// POST /api/calendar/reminders or /reminders
// -------------------------------------------------------------
function isValidTimeZone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

router.post(['/api/calendar/reminders', '/reminders'], authMiddleware, async (req, res) => {
  try {
    const user = await userStorage.findById(req.user.id);

    if (!user) {
      return res.status(401).json({ success: false, error: 'User session not found. Please log in.' });
    }

    const isConnected = Boolean(
      (user.google_calendar_connected === true || user.google_calendar_connected === 'true') &&
      user.google_refresh_token
    );

    if (!isConnected) {
      return res.status(400).json({
        success: false,
        error: "Google Calendar isn't connected. Please connect Google Calendar first."
      });
    }

    const { title, description, startTime, endTime, reminderMinutes, timeZone } = req.body || {};

    // 1. Validate Title
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required.' });
    }

    // 2. Validate Start Time
    if (!startTime || isNaN(new Date(startTime).getTime())) {
      return res.status(400).json({ success: false, error: 'A valid startTime ISO date string is required.' });
    }

    const startDate = new Date(startTime);

    // 3. Validate / Default End Time
    let endDate;
    if (endTime) {
      if (isNaN(new Date(endTime).getTime())) {
        return res.status(400).json({ success: false, error: 'Invalid endTime ISO date string.' });
      }
      endDate = new Date(endTime);
      if (endDate.getTime() <= startDate.getTime()) {
        return res.status(400).json({ success: false, error: 'endTime must be strictly after startTime.' });
      }
    } else {
      // Default: 30 minutes duration
      endDate = new Date(startDate.getTime() + 30 * 60 * 1000);
    }

    // 4. Validate Timezone (accept IANA timezones)
    const tz = (timeZone || 'UTC').trim();
    if (!isValidTimeZone(tz)) {
      return res.status(400).json({
        success: false,
        error: `Invalid IANA timezone: "${tz}". Example: Asia/Kolkata, America/New_York, Europe/London.`
      });
    }

    // 5. Validate Reminder Minutes
    const remMins = reminderMinutes !== undefined ? parseInt(reminderMinutes, 10) : 10;
    if (isNaN(remMins) || remMins < 0) {
      return res.status(400).json({
        success: false,
        error: 'reminderMinutes must be a non-negative integer (e.g. 0, 5, 10, 15, 30, 60).'
      });
    }

    // 6. Direct Google Calendar API creation (NO reminder saved in database/sheets)
    const event = await googleCalendarService.createReminderEvent(user, {
      title: title.trim(),
      description: description ? description.trim() : '',
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      reminderMinutes: remMins,
      timeZone: tz
    });

    return res.status(200).json({
      success: true,
      message: 'Reminder added to Google Calendar.',
      event: {
        id: event.id,
        htmlLink: event.htmlLink
      }
    });
  } catch (err) {
    console.error('[CalendarRoutes] Error creating calendar reminder:', err.message);

    if (err.statusCode === 401 || err.reconnect) {
      return res.status(401).json({
        success: false,
        error: 'Google Calendar authorization expired or revoked. Please reconnect Google Calendar.'
      });
    }

    return res.status(err.statusCode || 500).json({
      success: false,
      error: err.message || 'Failed to create reminder in Google Calendar.'
    });
  }
});

module.exports = router;
