const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

const USERS_SHEET_TITLE = 'Users';
const USER_COLUMNS = [
  'id',
  'name',
  'email',
  'password_hash',
  'google_id',
  'google_refresh_token',
  'google_calendar_connected',
  'reset_token_hash',
  'reset_token_expires_at',
  'created_at',
  'updated_at'
];

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isVercel ? path.join('/tmp', 'data') : path.join(__dirname, '..', '..', 'data');
const LOCAL_USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data directory exists for local fallback
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('[UserStorage] Could not create local data directory:', err.message);
}

// Local fallback helpers
function readLocalUsers() {
  try {
    if (fs.existsSync(LOCAL_USERS_FILE)) {
      const content = fs.readFileSync(LOCAL_USERS_FILE, 'utf8');
      return JSON.parse(content || '[]');
    }
  } catch (err) {
    console.warn('[UserStorage] Could not read local users file:', err.message);
  }
  return [];
}

function writeLocalUsers(users) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    console.error('[UserStorage] Could not write local users file:', err.message);
  }
}

class UserStorage {
  constructor() {
    this.sheetsClient = null;
    this.spreadsheetId = null;
    this.isUsingGoogleSheets = false;
    this.initPromise = null;
  }

  async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._initInternal();
    return this.initPromise;
  }

  async _initInternal() {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    const rawPrivateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;

    if (!spreadsheetId || !clientEmail || !rawPrivateKey) {
      console.log('[UserStorage] Google Sheets credentials not fully set in .env. Using secure local file fallback.');
      this.isUsingGoogleSheets = false;
      return;
    }

    try {
      let privateKey = (rawPrivateKey || '').trim().replace(/^["'`]+|["'`]+$/g, '');
      privateKey = privateKey.replace(/\\n/g, '\n');
      const auth = new JWT({
        email: clientEmail.trim().replace(/^["'`]+|["'`]+$/g, ''),
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      this.sheetsClient = google.sheets({ version: 'v4', auth });
      this.spreadsheetId = spreadsheetId;

      // Check if 'Users' sheet exists, create if not
      const meta = await this.sheetsClient.spreadsheets.get({ spreadsheetId });
      const sheetsList = meta.data.sheets || [];
      const userSheet = sheetsList.find(s => s.properties?.title === USERS_SHEET_TITLE);

      if (!userSheet) {
        console.log(`[UserStorage] Creating '${USERS_SHEET_TITLE}' sheet in Google Spreadsheet...`);
        await this.sheetsClient.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: { title: USERS_SHEET_TITLE }
                }
              }
            ]
          }
        });
        // Set header row
        await this.sheetsClient.spreadsheets.values.update({
          spreadsheetId,
          range: `${USERS_SHEET_TITLE}!A1:K1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [USER_COLUMNS] }
        });
      } else {
        // Ensure header exists
        const headerRes = await this.sheetsClient.spreadsheets.values.get({
          spreadsheetId,
          range: `${USERS_SHEET_TITLE}!A1:K1`
        });
        const headerRow = headerRes.data.values?.[0] || [];
        if (headerRow.length === 0) {
          await this.sheetsClient.spreadsheets.values.update({
            spreadsheetId,
            range: `${USERS_SHEET_TITLE}!A1:K1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [USER_COLUMNS] }
          });
        }
      }

      this.isUsingGoogleSheets = true;
      console.log(`[UserStorage] Connected to Google Sheets via official SDK. Users stored in '${USERS_SHEET_TITLE}'.`);
    } catch (err) {
      console.warn('[UserStorage] Google Sheets connection failed:', err.message);
      console.warn('[UserStorage] Falling back to local data storage.');
      this.isUsingGoogleSheets = false;
    }
  }

  // Read all user records from Google Sheets
  async _getGoogleSheetUsers() {
    if (!this.isUsingGoogleSheets || !this.sheetsClient) return null;
    try {
      const res = await this.sheetsClient.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${USERS_SHEET_TITLE}!A2:K`
      });
      const rows = res.data.values || [];
      return rows.map((row, idx) => ({
        rowIndex: idx + 2, // 1-indexed, starts after header
        user: {
          id: row[0] || '',
          name: row[1] || '',
          email: (row[2] || '').trim().toLowerCase(),
          password_hash: row[3] || '',
          google_id: row[4] || '',
          google_refresh_token: row[5] || '',
          google_calendar_connected: row[6] === 'true',
          reset_token_hash: row[7] || '',
          reset_token_expires_at: row[8] || '',
          created_at: row[9] || '',
          updated_at: row[10] || ''
        }
      }));
    } catch (err) {
      console.warn('[UserStorage] Error reading from Google Sheets:', err.message);
      return null;
    }
  }

  async findByEmail(email) {
    await this.init();
    const normalized = (email || '').trim().toLowerCase();
    if (!normalized) return null;

    const sheetUsers = await this._getGoogleSheetUsers();
    if (sheetUsers) {
      const match = sheetUsers.find(item => item.user.email === normalized);
      return match ? match.user : null;
    }

    const users = readLocalUsers();
    return users.find(u => (u.email || '').toLowerCase() === normalized) || null;
  }

  async findById(id) {
    await this.init();
    if (!id) return null;

    const sheetUsers = await this._getGoogleSheetUsers();
    if (sheetUsers) {
      const match = sheetUsers.find(item => item.user.id === id);
      return match ? match.user : null;
    }

    const users = readLocalUsers();
    return users.find(u => u.id === id) || null;
  }

  async findByResetTokenHash(tokenHash) {
    await this.init();
    if (!tokenHash) return null;

    const sheetUsers = await this._getGoogleSheetUsers();
    if (sheetUsers) {
      const match = sheetUsers.find(item => item.user.reset_token_hash === tokenHash);
      return match ? match.user : null;
    }

    const users = readLocalUsers();
    return users.find(u => u.reset_token_hash === tokenHash) || null;
  }

  async createUser(userData) {
    await this.init();
    const now = new Date().toISOString();
    const record = {
      id: userData.id,
      name: userData.name || '',
      email: (userData.email || '').trim().toLowerCase(),
      password_hash: userData.password_hash || '',
      google_id: userData.google_id || '',
      google_refresh_token: userData.google_refresh_token || '',
      google_calendar_connected: userData.google_calendar_connected ? 'true' : 'false',
      reset_token_hash: userData.reset_token_hash || '',
      reset_token_expires_at: userData.reset_token_expires_at || '',
      created_at: userData.created_at || now,
      updated_at: userData.updated_at || now
    };

    if (this.isUsingGoogleSheets && this.sheetsClient) {
      try {
        const rowValues = [
          record.id,
          record.name,
          record.email,
          record.password_hash,
          record.google_id,
          record.google_refresh_token,
          record.google_calendar_connected,
          record.reset_token_hash,
          record.reset_token_expires_at,
          record.created_at,
          record.updated_at
        ];

        await this.sheetsClient.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: `${USERS_SHEET_TITLE}!A:K`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [rowValues] }
        });
        return record;
      } catch (err) {
        console.error('[UserStorage] Failed to append user to Google Sheets:', err.message);
      }
    }

    // Local fallback
    const users = readLocalUsers();
    users.push(record);
    writeLocalUsers(users);
    return record;
  }

  async updateUser(id, updates) {
    await this.init();
    const now = new Date().toISOString();
    const safeUpdates = {
      ...updates,
      updated_at: now
    };

    if (this.isUsingGoogleSheets && this.sheetsClient) {
      try {
        const sheetUsers = await this._getGoogleSheetUsers();
        const match = sheetUsers?.find(item => item.user.id === id);
        if (match) {
          const merged = { ...match.user, ...safeUpdates };
          const rowValues = [
            merged.id,
            merged.name,
            merged.email,
            merged.password_hash,
            merged.google_id,
            merged.google_refresh_token,
            merged.google_calendar_connected ? 'true' : 'false',
            merged.reset_token_hash,
            merged.reset_token_expires_at,
            merged.created_at,
            merged.updated_at
          ];

          await this.sheetsClient.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${USERS_SHEET_TITLE}!A${match.rowIndex}:K${match.rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [rowValues] }
          });
          return merged;
        }
      } catch (err) {
        console.error('[UserStorage] Failed to update user in Google Sheets:', err.message);
      }
    }

    // Local fallback
    const users = readLocalUsers();
    const index = users.findIndex(u => u.id === id);
    if (index >= 0) {
      users[index] = {
        ...users[index],
        ...safeUpdates
      };
      writeLocalUsers(users);
      return users[index];
    }
    return null;
  }
}

module.exports = new UserStorage();
