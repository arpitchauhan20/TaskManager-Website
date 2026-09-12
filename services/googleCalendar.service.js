// ==========================================
// Google Calendar & OAuth 2.0 Backend Service
// Official googleapis integration
// ==========================================
const crypto = require('crypto');
const { google } = require('googleapis');
const userStorage = require('./storage/userStorage');

// Helper to derive a 32-byte encryption key for AES-256-GCM
function getEncryptionKey() {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || 'taskflow-pro-saas-token-encryption-key-2026';
  return crypto.scryptSync(secret, 'taskflow-saas-salt', 32);
}

// Encrypt refresh token before saving in storage
function encryptToken(plainToken) {
  if (!plainToken || typeof plainToken !== 'string') return '';
  if (plainToken.startsWith('enc:')) return plainToken; // Already encrypted

  const iv = crypto.randomBytes(12); // 96-bit IV
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  let encrypted = cipher.update(plainToken, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `enc:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

// Decrypt refresh token when retrieving for Google API client
function decryptToken(encryptedText) {
  if (!encryptedText || typeof encryptedText !== 'string') return '';
  if (!encryptedText.startsWith('enc:')) {
    return encryptedText; // Legacy / unencrypted token support
  }

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 4) return encryptedText;
    const iv = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const cipherHex = parts[3];

    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.warn('[GoogleCalendarService] Failed to decrypt refresh token:', err.message);
    return encryptedText;
  }
}

class GoogleCalendarService {
  encryptToken(plainToken) {
    return encryptToken(plainToken);
  }

  decryptToken(encryptedText) {
    return decryptToken(encryptedText);
  }
  getClientId() {
    return (process.env.GOOGLE_CLIENT_ID || '').trim();
  }

  getClientSecret() {
    return (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  }

  getRedirectUri(req = null) {
    const raw = process.env.GOOGLE_REDIRECT_URI;
    if (raw && raw.trim()) return raw.trim();
    const appUrl = process.env.APP_URL;
    if (appUrl && appUrl.trim()) {
      return `${appUrl.trim().replace(/\/$/, '')}/auth/google/callback`;
    }
    if (req) {
      const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers['host'];
      if (host) {
        return `${proto}://${host}/auth/google/callback`;
      }
    }
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}/auth/google/callback`;
    }
    return 'http://localhost:8080/auth/google/callback';
  }

  /**
   * Creates configured OAuth2 client instance using official googleapis
   */
  getOAuth2Client(req = null) {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    const redirectUri = this.getRedirectUri(req);

    if (!clientId || !clientSecret) {
      console.warn('[GoogleCalendarService] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.');
    }

    return new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );
  }

  /**
   * Generates authorization URL requesting minimum required Calendar scope
   * and offline access for refresh token.
   */
  generateAuthUrl(state = '', req = null) {
    const oauth2Client = this.getOAuth2Client(req);

    const scopes = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
      'openid'
    ];

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // Ensures refresh token is provided on consent
      scope: scopes,
      state
    });
  }

  /**
   * Exchanges authorization code for Google OAuth tokens
   * and identifies the Google account.
   */
  async exchangeCode(code, req = null) {
    const oauth2Client = this.getOAuth2Client(req);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    let googleId = '';
    let email = '';

    // Identify Google account
    try {
      if (tokens.id_token) {
        const ticket = await oauth2Client.verifyIdToken({
          idToken: tokens.id_token,
          audience: this.getClientId()
        });
        const payload = ticket.getPayload();
        googleId = payload?.sub || '';
        email = payload?.email || '';
      }
    } catch (e) {
      console.warn('[GoogleCalendarService] Could not parse id_token directly:', e.message);
    }

    // Fallback account identification via oauth2 userinfo
    if (!googleId || !email) {
      try {
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        googleId = userInfo.data.id || googleId;
        email = userInfo.data.email || email;
      } catch (err) {
        console.warn('[GoogleCalendarService] Userinfo fetch fallback failed:', err.message);
      }
    }

    return {
      tokens,
      googleId,
      email
    };
  }

  /**
   * Validates user refresh token and checks if authorization is active.
   * If revoked or expired, automatically marks disconnected in storage.
   */
  async validateUserCalendarToken(user) {
    if (!user || !user.google_refresh_token) {
      return { connected: false };
    }

    const oauth2Client = this.getOAuth2Client();
    const cleanToken = decryptToken(user.google_refresh_token);
    oauth2Client.setCredentials({
      refresh_token: cleanToken
    });

    try {
      const { token } = await oauth2Client.getAccessToken();
      if (token) {
        return { connected: true, accessToken: token };
      }
      return { connected: false };
    } catch (err) {
      console.warn(`[GoogleCalendarService] Authorization invalid for user ${user.id}:`, err.message);
      // Mark disconnected gracefully without crashing
      await userStorage.updateUser(user.id, {
        google_calendar_connected: false,
        google_refresh_token: ''
      });
      return {
        connected: false,
        error: 'Google Calendar authorization has been revoked or expired. Please reconnect.'
      };
    }
  }

  /**
   * Revokes Google authorization and cleans up credentials
   */
  async revokeUserCalendar(user) {
    if (!user) return { success: true };

    const refreshToken = decryptToken(user.google_refresh_token);
    if (refreshToken) {
      try {
        const oauth2Client = this.getOAuth2Client();
        await oauth2Client.revokeToken(refreshToken);
        console.log(`[GoogleCalendarService] Revoked Google token for user ${user.id}`);
      } catch (err) {
        console.warn(`[GoogleCalendarService] Token revocation error (may already be revoked):`, err.message);
      }
    }

    await userStorage.updateUser(user.id, {
      google_calendar_connected: false,
      google_refresh_token: '',
      google_id: ''
    });

    return { success: true };
  }

  /**
   * Instantiates an authorized Google Calendar API client for a user
   */
  getCalendarClient(refreshToken) {
    const oauth2Client = this.getOAuth2Client();
    const cleanToken = decryptToken(refreshToken);
    oauth2Client.setCredentials({
      refresh_token: cleanToken
    });
    return google.calendar({ version: 'v3', auth: oauth2Client });
  }

  /**
   * Creates an event directly in the user's primary Google Calendar with a popup reminder.
   * NO reminder information is stored in the application database/sheets.
   */
  async createReminderEvent(user, { title, description, startTime, endTime, reminderMinutes = 10, timeZone = 'UTC' }) {
    if (!user || !user.google_refresh_token || !user.google_calendar_connected) {
      const err = new Error('Google Calendar is not connected. Please connect Google Calendar first.');
      err.statusCode = 400;
      err.needAuth = true;
      throw err;
    }

    const calendar = this.getCalendarClient(user.google_refresh_token);

    const eventPayload = {
      summary: String(title).trim(),
      description: description ? String(description).trim() : '',
      start: {
        dateTime: startTime,
        timeZone: timeZone || 'UTC'
      },
      end: {
        dateTime: endTime,
        timeZone: timeZone || 'UTC'
      },
      reminders: {
        useDefault: false,
        overrides: [
          {
            method: 'popup',
            minutes: Math.max(0, parseInt(reminderMinutes, 10) || 10)
          }
        ]
      }
    };

    try {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: eventPayload
      });

      return {
        id: response.data.id,
        htmlLink: response.data.htmlLink,
        summary: response.data.summary,
        start: response.data.start,
        end: response.data.end
      };
    } catch (apiErr) {
      console.error('[GoogleCalendarService] Failed to insert calendar event:', apiErr.message);

      // Handle revoked or expired tokens
      const msg = String(apiErr.message || '').toLowerCase();
      if (msg.includes('invalid_grant') || apiErr.code === 401 || apiErr.status === 401) {
        await userStorage.updateUser(user.id, {
          google_calendar_connected: false,
          google_refresh_token: ''
        });
        const err = new Error('Google Calendar authorization expired or revoked. Please reconnect.');
        err.statusCode = 401;
        err.reconnect = true;
        throw err;
      }

      const err = new Error(apiErr.message || 'Failed to create event in Google Calendar.');
      err.statusCode = apiErr.code || 500;
      throw err;
    }
  }
}

module.exports = new GoogleCalendarService();
