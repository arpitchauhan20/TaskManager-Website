const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

const TASKS_SHEET_TITLE = 'Tasks';
const TASK_COLUMNS = [
  'id',
  'user_id',
  'title',
  'description',
  'deadline',
  'priority',
  'category',
  'completed',
  'tags',
  'reminder_time',
  'reminder_channel',
  'sort_order',
  'created_at',
  'updated_at'
];

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isVercel ? path.join('/tmp', 'data') : path.join(__dirname, '..', '..', 'data');
const LOCAL_TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

// Ensure data directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('[TaskStorage] Could not create local data directory:', err.message);
}

function readLocalTasks() {
  try {
    if (fs.existsSync(LOCAL_TASKS_FILE)) {
      const content = fs.readFileSync(LOCAL_TASKS_FILE, 'utf8');
      return JSON.parse(content || '[]');
    }
  } catch (err) {
    console.warn('[TaskStorage] Could not read local tasks file:', err.message);
  }
  return [];
}

function writeLocalTasks(tasks) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf8');
  } catch (err) {
    console.error('[TaskStorage] Could not write local tasks file:', err.message);
  }
}

function cleanPrivateKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return '';
  let key = rawKey.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  key = key.replace(/\\n/g, '\n');
  key = key.replace(/\r\n/g, '\n');
  key = key.replace(/^["']+|["']+$/g, '').trim();
  return key;
}

class TaskStorage {
  constructor() {
    this.sheetsClient = null;
    this.spreadsheetId = null;
    this.isUsingGoogleSheets = false;
    this.initPromise = null;
    this.lastInitError = null;
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
      const missing = [];
      if (!spreadsheetId) missing.push('GOOGLE_SHEETS_SPREADSHEET_ID');
      if (!clientEmail) missing.push('GOOGLE_SHEETS_CLIENT_EMAIL');
      if (!rawPrivateKey) missing.push('GOOGLE_SHEETS_PRIVATE_KEY');
      this.lastInitError = `Missing environment variables: ${missing.join(', ')}`;
      console.log(`[TaskStorage] Google Sheets credentials missing (${this.lastInitError}). Using local storage fallback.`);
      this.isUsingGoogleSheets = false;
      return;
    }

    try {
      const privateKey = cleanPrivateKey(rawPrivateKey);
      const auth = new JWT({
        email: clientEmail.trim().replace(/^["'`]+|["'`]+$/g, ''),
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      this.sheetsClient = google.sheets({ version: 'v4', auth });
      this.spreadsheetId = spreadsheetId;

      // Check if 'Tasks' sheet exists, create if not
      const meta = await this.sheetsClient.spreadsheets.get({ spreadsheetId });
      const sheetsList = meta.data.sheets || [];
      const taskSheet = sheetsList.find(s => s.properties?.title === TASKS_SHEET_TITLE);

      if (!taskSheet) {
        console.log(`[TaskStorage] Creating '${TASKS_SHEET_TITLE}' sheet tab in Google Spreadsheet...`);
        await this.sheetsClient.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: { title: TASKS_SHEET_TITLE }
                }
              }
            ]
          }
        });
        await this.sheetsClient.spreadsheets.values.update({
          spreadsheetId,
          range: `${TASKS_SHEET_TITLE}!A1:N1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [TASK_COLUMNS] }
        });
      } else {
        const headerRes = await this.sheetsClient.spreadsheets.values.get({
          spreadsheetId,
          range: `${TASKS_SHEET_TITLE}!A1:N1`
        });
        const headerRow = headerRes.data.values?.[0] || [];
        if (headerRow.length === 0) {
          await this.sheetsClient.spreadsheets.values.update({
            spreadsheetId,
            range: `${TASKS_SHEET_TITLE}!A1:N1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [TASK_COLUMNS] }
          });
        }
      }

      this.isUsingGoogleSheets = true;
      this.lastInitError = null;
      console.log(`[TaskStorage] Connected to Google Sheets. Tasks stored in '${TASKS_SHEET_TITLE}'.`);
    } catch (err) {
      this.lastInitError = err.message;
      console.warn('[TaskStorage] Google Sheets connection failed:', err.message);
      this.isUsingGoogleSheets = false;
    }
  }

  async _getGoogleSheetTasks() {
    if (!this.isUsingGoogleSheets || !this.sheetsClient) return null;
    try {
      const res = await this.sheetsClient.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${TASKS_SHEET_TITLE}!A2:N`
      });
      const rows = res.data.values || [];
      return rows.map((row, idx) => ({
        rowIndex: idx + 2,
        task: {
          id: row[0] || '',
          user_id: row[1] || '',
          title: row[2] || '',
          description: row[3] || '',
          deadline: row[4] || '',
          priority: row[5] || 'medium',
          category: row[6] || 'work',
          completed: row[7] === 'true',
          tags: row[8] ? JSON.parse(row[8] || '[]') : [],
          reminder_time: row[9] || '',
          reminder_channel: row[10] || '',
          sort_order: parseInt(row[11] || '0', 10),
          created_at: row[12] || '',
          updated_at: row[13] || ''
        }
      }));
    } catch (err) {
      console.warn('[TaskStorage] Error reading from Google Sheets:', err.message);
      return null;
    }
  }

  async getTasksByUserId(userId) {
    await this.init();
    if (!userId) return [];

    const sheetTasks = await this._getGoogleSheetTasks();
    if (sheetTasks) {
      return sheetTasks
        .filter(item => item.task.user_id === userId)
        .map(item => item.task)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }

    const localTasks = readLocalTasks();
    return localTasks
      .filter(t => t.user_id === userId)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  async getTaskById(userId, taskId) {
    await this.init();
    if (!userId || !taskId) return null;

    const sheetTasks = await this._getGoogleSheetTasks();
    if (sheetTasks) {
      const match = sheetTasks.find(item => item.task.user_id === userId && item.task.id === taskId);
      return match ? match.task : null;
    }

    const localTasks = readLocalTasks();
    return localTasks.find(t => t.user_id === userId && t.id === taskId) || null;
  }

  async createTask(userId, taskData) {
    await this.init();
    const now = new Date().toISOString();
    const task = {
      id: taskData.id || 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      user_id: userId,
      title: taskData.title || '',
      description: taskData.description || '',
      deadline: taskData.deadline || '',
      priority: taskData.priority || 'medium',
      category: taskData.category || 'work',
      completed: Boolean(taskData.completed),
      tags: Array.isArray(taskData.tags) ? taskData.tags : [],
      reminder_time: taskData.reminder_time || '',
      reminder_channel: taskData.reminder_channel || '',
      sort_order: taskData.sort_order !== undefined ? parseInt(taskData.sort_order, 10) : 0,
      created_at: taskData.created_at || now,
      updated_at: taskData.updated_at || now
    };

    if (this.isUsingGoogleSheets && this.sheetsClient) {
      try {
        const rowValues = [
          task.id,
          task.user_id,
          task.title,
          task.description,
          task.deadline,
          task.priority,
          task.category,
          task.completed ? 'true' : 'false',
          JSON.stringify(task.tags),
          task.reminder_time,
          task.reminder_channel,
          String(task.sort_order),
          task.created_at,
          task.updated_at
        ];

        await this.sheetsClient.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: `${TASKS_SHEET_TITLE}!A:N`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [rowValues] }
        });
        return task;
      } catch (err) {
        console.warn('[TaskStorage] Failed to append task to Google Sheets, using local fallback:', err.message);
      }
    }

    const tasks = readLocalTasks();
    tasks.push(task);
    writeLocalTasks(tasks);
    return task;
  }

  async updateTask(userId, taskId, updates) {
    await this.init();
    const now = new Date().toISOString();

    if (this.isUsingGoogleSheets && this.sheetsClient) {
      try {
        const sheetTasks = await this._getGoogleSheetTasks();
        if (sheetTasks) {
          const match = sheetTasks.find(item => item.task.user_id === userId && item.task.id === taskId);
          if (match) {
            const updated = {
              ...match.task,
              ...updates,
              updated_at: now
            };

            const rowValues = [
              updated.id,
              updated.user_id,
              updated.title,
              updated.description,
              updated.deadline,
              updated.priority,
              updated.category,
              updated.completed ? 'true' : 'false',
              JSON.stringify(updated.tags || []),
              updated.reminder_time || '',
              updated.reminder_channel || '',
              String(updated.sort_order !== undefined ? updated.sort_order : 0),
              updated.created_at,
              updated.updated_at
            ];

            await this.sheetsClient.spreadsheets.values.update({
              spreadsheetId: this.spreadsheetId,
              range: `${TASKS_SHEET_TITLE}!A${match.rowIndex}:N${match.rowIndex}`,
              valueInputOption: 'USER_ENTERED',
              requestBody: { values: [rowValues] }
            });

            return updated;
          }
        }
      } catch (err) {
        console.warn('[TaskStorage] Google Sheets update error, falling back:', err.message);
      }
    }

    const tasks = readLocalTasks();
    const idx = tasks.findIndex(t => t.user_id === userId && t.id === taskId);
    if (idx !== -1) {
      tasks[idx] = {
        ...tasks[idx],
        ...updates,
        updated_at: now
      };
      writeLocalTasks(tasks);
      return tasks[idx];
    }

    return null;
  }

  async deleteTask(userId, taskId) {
    await this.init();

    if (this.isUsingGoogleSheets && this.sheetsClient) {
      try {
        const sheetTasks = await this._getGoogleSheetTasks();
        if (sheetTasks) {
          const match = sheetTasks.find(item => item.task.user_id === userId && item.task.id === taskId);
          if (match) {
            await this.sheetsClient.spreadsheets.values.clear({
              spreadsheetId: this.spreadsheetId,
              range: `${TASKS_SHEET_TITLE}!A${match.rowIndex}:N${match.rowIndex}`
            });
            return true;
          }
        }
      } catch (err) {
        console.warn('[TaskStorage] Google Sheets delete error, falling back:', err.message);
      }
    }

    const tasks = readLocalTasks();
    const filtered = tasks.filter(t => !(t.user_id === userId && t.id === taskId));
    const wasDeleted = filtered.length < tasks.length;
    if (wasDeleted) {
      writeLocalTasks(filtered);
    }
    return wasDeleted;
  }

  async syncTasks(userId, clientTasks) {
    await this.init();
    if (!userId || !Array.isArray(clientTasks)) {
      return await this.getTasksByUserId(userId);
    }

    const existingTasks = await this.getTasksByUserId(userId);
    const existingMap = new Map(existingTasks.map(t => [t.id, t]));

    for (const clientTask of clientTasks) {
      if (!clientTask.id || !clientTask.title) continue;

      if (existingMap.has(clientTask.id)) {
        const serverTask = existingMap.get(clientTask.id);
        const clientUpdated = new Date(clientTask.updated_at || clientTask.created_at || 0).getTime();
        const serverUpdated = new Date(serverTask.updated_at || serverTask.created_at || 0).getTime();

        if (clientUpdated > serverUpdated) {
          await this.updateTask(userId, clientTask.id, clientTask);
        }
      } else {
        await this.createTask(userId, clientTask);
      }
    }

    return await this.getTasksByUserId(userId);
  }
}

const taskStorage = new TaskStorage();
module.exports = taskStorage;
