// ==========================================
// TaskFlow Pro — Client Task API Service
// Synchronizes tasks with backend and Google Sheets
// ==========================================

const API_BASE = '/api/tasks';

async function request(endpoint = '', options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  try {
    const token = localStorage.getItem('taskflow_auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {}

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = { success: false, error: 'Network error or invalid server response.' };
  }

  if (!response.ok) {
    throw new Error(data.error || 'Task API request failed');
  }

  return data;
}

export const TaskClient = {
  // 1. Fetch all tasks for current authenticated user
  async getTasks() {
    try {
      const data = await request('', { method: 'GET' });
      return data.tasks || [];
    } catch (err) {
      console.warn('[TaskClient] Failed to load tasks from server:', err.message);
      return null;
    }
  },

  // 2. Create new task
  async createTask(taskData) {
    try {
      const data = await request('', {
        method: 'POST',
        body: JSON.stringify(taskData)
      });
      return data.task || null;
    } catch (err) {
      console.warn('[TaskClient] Failed to create task on server:', err.message);
      return null;
    }
  },

  // 3. Update existing task
  async updateTask(taskId, updates) {
    try {
      const data = await request(`/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
      return data.task || null;
    } catch (err) {
      console.warn('[TaskClient] Failed to update task on server:', err.message);
      return null;
    }
  },

  // 4. Delete task
  async deleteTask(taskId) {
    try {
      const data = await request(`/${taskId}`, {
        method: 'DELETE'
      });
      return Boolean(data.success);
    } catch (err) {
      console.warn('[TaskClient] Failed to delete task on server:', err.message);
      return false;
    }
  },

  // 5. Bulk sync tasks
  async syncTasks(clientTasks) {
    try {
      const data = await request('/sync', {
        method: 'POST',
        body: JSON.stringify({ tasks: clientTasks })
      });
      return data.tasks || null;
    } catch (err) {
      console.warn('[TaskClient] Failed to sync tasks with server:', err.message);
      return null;
    }
  }
};
