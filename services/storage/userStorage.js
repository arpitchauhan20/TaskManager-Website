const fs = require('fs');
const path = require('path');
const { GoogleSpreadsheet } = require('google-spreadsheet');
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
    fs.writeFileSync(LOCAL_USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    console.error('[UserStorage] Could not write local users file:', err.message);
  }
}

class UserStorage {
  constructor() {
    this.sheetDoc = null;
    this.usersSheet = null;
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
      console.log('[UserStorage] Google Sheets credentials not fully set in .env. Using secure local file fallback (data/users.json).');
      this.isUsingGoogleSheets = false;
      return;
    }

    try {
      const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
      const serviceAccountAuth = new JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
      await doc.loadInfo();

      let sheet = doc.sheetsByTitle[USERS_SHEET_TITLE];
      if (!sheet) {
        console.log(`[UserStorage] Creating '${USERS_SHEET_TITLE}' sheet in Google Spreadsheet...`);
        sheet = await doc.addSheet({
          title: USERS_SHEET_TITLE,
          headerValues: USER_COLUMNS
        });
      } else {
        await sheet.loadHeaderRow();
        // Verify or populate headers if empty
        if (!sheet.headerValues || sheet.headerValues.length === 0) {
          await sheet.setHeaderRow(USER_COLUMNS);
        }
      }

      this.sheetDoc = doc;
      this.usersSheet = sheet;
      this.isUsingGoogleSheets = true;
      console.log(`[UserStorage] Connected to Google Sheets. Users stored in '${USERS_SHEET_TITLE}' sheet.`);
    } catch (err) {
      console.warn('[UserStorage] Google Sheets connection failed:', err.message);
      console.warn('[UserStorage] Falling back to local data/users.json store.');
      this.isUsingGoogleSheets = false;
    }
  }

  // Find user by normalized email
  async findByEmail(email) {
    await this.init();
    const normalized = (email || '').trim().toLowerCase();
    if (!normalized) return null;

    if (this.isUsingGoogleSheets && this.usersSheet) {
      try {
        const rows = await this.usersSheet.getRows();
        const row = rows.find(r => (r.get('email') || '').trim().toLowerCase() === normalized);
        return row ? this._rowToUser(row) : null;
      } catch (err) {
        console.warn('[UserStorage] Error reading from Google Sheets, checking local fallback:', err.message);
      }
    }

    const users = readLocalUsers();
    return users.find(u => (u.email || '').toLowerCase() === normalized) || null;
  }

  // Find user by unique ID
  async findById(id) {
    await this.init();
    if (!id) return null;

    if (this.isUsingGoogleSheets && this.usersSheet) {
      try {
        const rows = await this.usersSheet.getRows();
        const row = rows.find(r => r.get('id') === id);
        return row ? this._rowToUser(row) : null;
      } catch (err) {
        console.warn('[UserStorage] Error reading from Google Sheets:', err.message);
      }
    }

    const users = readLocalUsers();
    return users.find(u => u.id === id) || null;
  }

  // Find user by reset token hash
  async findByResetTokenHash(tokenHash) {
    await this.init();
    if (!tokenHash) return null;

    if (this.isUsingGoogleSheets && this.usersSheet) {
      try {
        const rows = await this.usersSheet.getRows();
        const row = rows.find(r => r.get('reset_token_hash') === tokenHash);
        return row ? this._rowToUser(row) : null;
      } catch (err) {
        console.warn('[UserStorage] Error reading reset token from Google Sheets:', err.message);
      }
    }

    const users = readLocalUsers();
    return users.find(u => u.reset_token_hash === tokenHash) || null;
  }

  // Create new user
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

    if (this.isUsingGoogleSheets && this.usersSheet) {
      try {
        await this.usersSheet.addRow(record);
        return record;
      } catch (err) {
        console.error('[UserStorage] Failed to add user to Google Sheets:', err.message);
      }
    }

    // Local fallback
    const users = readLocalUsers();
    users.push(record);
    writeLocalUsers(users);
    return record;
  }

  // Update existing user fields
  async updateUser(id, updates) {
    await this.init();
    const now = new Date().toISOString();
    const safeUpdates = {
      ...updates,
      updated_at: now
    };

    if (this.isUsingGoogleSheets && this.usersSheet) {
      try {
        const rows = await this.usersSheet.getRows();
        const row = rows.find(r => r.get('id') === id);
        if (row) {
          Object.keys(safeUpdates).forEach(key => {
            if (USER_COLUMNS.includes(key)) {
              row.set(key, safeUpdates[key] === null ? '' : String(safeUpdates[key]));
            }
          });
          await row.save();
          return this._rowToUser(row);
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

  _rowToUser(row) {
    return {
      id: row.get('id') || '',
      name: row.get('name') || '',
      email: (row.get('email') || '').trim().toLowerCase(),
      password_hash: row.get('password_hash') || '',
      google_id: row.get('google_id') || '',
      google_refresh_token: row.get('google_refresh_token') || '',
      google_calendar_connected: row.get('google_calendar_connected') === 'true',
      reset_token_hash: row.get('reset_token_hash') || '',
      reset_token_expires_at: row.get('reset_token_expires_at') || '',
      created_at: row.get('created_at') || '',
      updated_at: row.get('updated_at') || ''
    };
  }
}

module.exports = new UserStorage();
