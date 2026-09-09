// ==========================================
// Google Calendar & iCalendar (.ics) Service
// Direct OAuth 2.0 Integration via Google Identity Services
// ==========================================

export const GOOGLE_CLIENT_ID = '859743879600-ooa6qju33lo7lsr4bgjiab0jslcel287.apps.googleusercontent.com';

/**
 * Checks if a valid, non-expired Google OAuth access token is stored.
 */
export function getGoogleAccessToken() {
  try {
    const token = localStorage.getItem('taskflow_gcal_token');
    const expiresAt = parseInt(localStorage.getItem('taskflow_gcal_expires_at') || '0', 10);
    if (token && Date.now() < expiresAt) {
      return token;
    }
  } catch {
    // ignore
  }
  return null;
}

export function isGoogleCalendarConnected() {
  return !!getGoogleAccessToken();
}

export function getConnectedGoogleEmail() {
  try {
    return localStorage.getItem('taskflow_gcal_email') || null;
  } catch {
    return null;
  }
}

/**
 * Disconnects Google Calendar integration and revokes access token.
 */
export function disconnectGoogleCalendar() {
  try {
    const token = localStorage.getItem('taskflow_gcal_token');
    if (token && window.google?.accounts?.oauth2?.revoke) {
      window.google.accounts.oauth2.revoke(token, () => {});
    }
    localStorage.removeItem('taskflow_gcal_token');
    localStorage.removeItem('taskflow_gcal_expires_at');
    localStorage.removeItem('taskflow_gcal_email');
    localStorage.removeItem('taskflow_gcal_connected_at');
  } catch (e) {
    console.warn('Disconnect error:', e);
  }
}

/**
 * Prompts user with Google OAuth popup to authorize Google Calendar events.
 */
export function requestGoogleCalendarAccess({ promptConsent = false } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window environment not available'));
      return;
    }

    const checkGIS = () => !!(window.google && window.google.accounts && window.google.accounts.oauth2);

    const doRequest = () => {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/calendar.events',
          callback: async (resp) => {
            if (resp.error) {
              console.error('Google OAuth Error:', resp);
              reject(new Error(resp.error_description || resp.error || 'Google authorization failed'));
              return;
            }
            const expiresInMs = (parseInt(resp.expires_in, 10) || 3599) * 1000;
            const expiresAt = Date.now() + expiresInMs;
            localStorage.setItem('taskflow_gcal_token', resp.access_token);
            localStorage.setItem('taskflow_gcal_expires_at', expiresAt.toString());
            localStorage.setItem('taskflow_gcal_connected_at', new Date().toISOString());

            // Attempt to retrieve primary calendar account email
            await fetchPrimaryCalendarInfo(resp.access_token);

            resolve(resp.access_token);
          }
        });

        tokenClient.requestAccessToken({ prompt: promptConsent ? 'consent' : '' });
      } catch (err) {
        reject(err);
      }
    };

    if (checkGIS()) {
      doRequest();
    } else {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (checkGIS()) {
          clearInterval(interval);
          doRequest();
        } else if (attempts > 25) {
          clearInterval(interval);
          reject(new Error('Google Identity Services script did not load. Please check your network or ad-blocker.'));
        }
      }, 150);
    }
  });
}

/**
 * Fetches primary calendar metadata to identify connected user's email.
 */
export async function fetchPrimaryCalendarInfo(token) {
  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.id) {
        localStorage.setItem('taskflow_gcal_email', data.id);
        return data;
      }
    }
  } catch (e) {
    console.warn('Could not fetch calendar info:', e);
  }
  return null;
}

/**
 * Saves a task event directly to Google Calendar using the Google Calendar REST API.
 * Hands-free: No tab or manual "Save" click needed.
 */
export async function saveEventToGoogleCalendar(task) {
  const token = getGoogleAccessToken();
  if (!token) {
    return { success: false, needAuth: true, error: 'Google Calendar is not connected.' };
  }

  const deadline = task.deadline ? new Date(task.deadline) : new Date(Date.now() + 3600000);
  const deadlineEnd = new Date(deadline.getTime() + 30 * 60 * 1000); // 30 min duration

  // Calculate reminder offset
  let remMs = task.reminderTime;
  if (!remMs) {
    if (task.reminderMode === 'preset') {
      const m = parseInt(task.reminderPresetMinutes, 10) || 15;
      remMs = deadline.getTime() - m * 60000;
    } else if (task.reminderMode === 'exact' && task.reminderExact) {
      remMs = new Date(task.reminderExact).getTime();
    } else if (task.reminderMode === 'offset') {
      const val = parseFloat(task.reminderOffsetValue) || 1;
      const unit = task.reminderOffsetUnit || 'hours';
      const multipliers = { minutes: 60000, hours: 3600000, days: 86400000 };
      remMs = deadline.getTime() - val * (multipliers[unit] || 3600000);
    } else {
      remMs = deadline.getTime() - 15 * 60000;
    }
  }

  const offsetMinutes = Math.max(1, Math.round((deadline.getTime() - remMs) / 60000));
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const eventPayload = {
    summary: `🎯 Deadline: ${task.title}`,
    description: `Task: ${task.title}\nDeadline: ${deadline.toLocaleString()}\n⏰ Reminder Alert set for: ${new Date(remMs).toLocaleString()}\nPriority: ${(task.priority || 'medium').toUpperCase()}${task.description ? '\n\n' + task.description : ''}\n\nManaged via TaskFlow Pro: https://task-manager-website-psi.vercel.app`,
    start: {
      dateTime: deadline.toISOString(),
      timeZone
    },
    end: {
      dateTime: deadlineEnd.toISOString(),
      timeZone
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: offsetMinutes },
        { method: 'email', minutes: offsetMinutes }
      ]
    }
  };

  try {
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventPayload)
    });

    if (response.status === 401) {
      // Token expired or revoked
      disconnectGoogleCalendar();
      return { success: false, needAuth: true, error: 'Google Calendar session expired. Please reconnect.' };
    }

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const msg = errJson.error?.message || `Google Calendar API returned status ${response.status}`;
      return { success: false, error: msg };
    }

    const data = await response.json();
    return {
      success: true,
      htmlLink: data.htmlLink,
      id: data.id,
      summary: data.summary
    };
  } catch (err) {
    console.error('Error saving directly to Google Calendar:', err);
    return { success: false, error: err.message || 'Failed to communicate with Google Calendar API.' };
  }
}

export function formatGCalDate(date) {
  const d = new Date(date);
  return d.toISOString().replace(/-|:|\.\d\d\d/g, '');
}

/**
 * Fallback: Opens prefilled Google Calendar web URL in a new tab.
 */
export function openGoogleCalendar(task) {
  const deadline = task.deadline ? new Date(task.deadline) : new Date(Date.now() + 3600000);
  const end = new Date(deadline.getTime() + 30 * 60 * 1000);

  let remMs = task.reminderTime;
  if (!remMs) {
    if (task.reminderMode === 'preset') {
      const m = parseInt(task.reminderPresetMinutes, 10) || 15;
      remMs = deadline.getTime() - m * 60000;
    } else if (task.reminderMode === 'exact' && task.reminderExact) {
      remMs = new Date(task.reminderExact).getTime();
    } else if (task.reminderMode === 'offset') {
      const val = parseFloat(task.reminderOffsetValue) || 1;
      const unit = task.reminderOffsetUnit || 'hours';
      const multipliers = { minutes: 60000, hours: 3600000, days: 86400000 };
      remMs = deadline.getTime() - val * (multipliers[unit] || 3600000);
    } else {
      remMs = deadline.getTime() - 15 * 60000;
    }
  }
  const remDate = new Date(remMs);

  const title = encodeURIComponent(`🎯 Deadline: ${task.title}`);
  const details = encodeURIComponent(
    `Task: ${task.title}\nDeadline: ${deadline.toLocaleString()}\n⏰ Reminder Alert set for: ${remDate.toLocaleString()}\nPriority: ${(task.priority || 'medium').toUpperCase()}${task.description ? '\n\n' + task.description : ''}\n\nManaged via TaskFlow Pro: https://task-manager-website-psi.vercel.app`
  );

  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatGCalDate(deadline)}/${formatGCalDate(end)}&details=${details}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Generates and downloads a standard .ics calendar invite file.
 */
export function downloadICS(task) {
  const now = new Date();
  const formatICS = d => d.toISOString().replace(/-|:|\.\d\d\d/g, '');

  const deadline = task.deadline ? new Date(task.deadline) : new Date(Date.now() + 3600000);
  const deadlineEnd = new Date(deadline.getTime() + 30 * 60 * 1000);
  const taskId = task.id || Date.now();
  const cleanTitle = (task.title || 'task').replace(/[\r\n]/g, ' ');
  const priorityStr = (task.priority || 'medium').toUpperCase();
  const desc = (task.description || '').replace(/\r?\n/g, '\\n');

  let remMs = task.reminderTime;
  if (!remMs) {
    if (task.reminderMode === 'preset') {
      const m = parseInt(task.reminderPresetMinutes, 10) || 15;
      remMs = deadline.getTime() - m * 60000;
    } else if (task.reminderMode === 'exact' && task.reminderExact) {
      remMs = new Date(task.reminderExact).getTime();
    } else if (task.reminderMode === 'offset') {
      const val = parseFloat(task.reminderOffsetValue) || 1;
      const unit = task.reminderOffsetUnit || 'hours';
      const multipliers = { minutes: 60000, hours: 3600000, days: 86400000 };
      remMs = deadline.getTime() - val * (multipliers[unit] || 3600000);
    } else {
      remMs = deadline.getTime() - 15 * 60000;
    }
  }

  const offsetMinutes = Math.max(0, Math.round((deadline.getTime() - remMs) / 60000));

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TaskFlow Pro//Deadline Calendar Engine//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',

    // --- SCHEDULED DEADLINE EVENT WITH EMBEDDED REMINDER ALARM ---
    'BEGIN:VEVENT',
    `UID:taskflow_${taskId}@taskflow.pro`,
    `DTSTAMP:${formatICS(now)}`,
    `DTSTART:${formatICS(deadline)}`,
    `DTEND:${formatICS(deadlineEnd)}`,
    `SUMMARY:🎯 Deadline: ${cleanTitle}`,
    `DESCRIPTION:Task: ${cleanTitle}\\nDeadline: ${deadline.toLocaleString()}\\nPriority: ${priorityStr}\\n\\n${desc}\\n\\nManaged via TaskFlow Pro`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    `TRIGGER:-PT${offsetMinutes}M`,
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${cleanTitle} (Deadline: ${deadline.toLocaleTimeString()})`,
    'END:VALARM',
    'END:VEVENT',

    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${cleanTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_deadline.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
