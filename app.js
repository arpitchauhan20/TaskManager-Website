/* ==========================================================================
   TaskFlow Pro — Executive Core Application Logic
   ========================================================================== */

// ==========================================
// PERSISTENT STORAGE
// ==========================================
const Store = {
  get(key, fallback = null) {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }
};

// ==========================================
// STATE MANAGEMENT
// ==========================================
let tasks = Store.get('taskflow_tasks', []);
let userName = Store.get('taskflow_user', '');
let currentPalette = Store.get('taskflow_palette', 'indigo');
let soundEnabled = Store.get('taskflow_sound', true);
let currentFilter = 'all';
let searchQuery = '';
let currentSort = 'deadline-asc';
let editingTaskId = null;
let taskToDeleteId = null;
let reminderTimers = {};

// Modal Reminder State
let modalReminderMode = 'none'; // 'none' | 'preset' | 'offset' | 'exact'
let modalPresetMinutes = 15;
let modalOffsetValue = 2;
let modalOffsetUnit = 'hours';
let modalExactTime = '';

// Modal Channel Selection State
let modalChannels = {
  push: true,
  sound: true,
  calendar: false,
  whatsapp: false,
  email: false
};

// ==========================================
// AUDIO ENGINE (Web Audio API Synthesizer)
// ==========================================
class SoundFX {
  static getAudioContext() {
    if (!window.AudioContext && !window.webkitAudioContext) return null;
    if (!SoundFX.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      SoundFX.ctx = new AudioCtx();
    }
    if (SoundFX.ctx.state === 'suspended') {
      SoundFX.ctx.resume();
    }
    return SoundFX.ctx;
  }

  // Long, sustained 5.5-second executive melodic chime sequence
  static playReminderChime() {
    if (!soundEnabled) return;
    try {
      const ctx = SoundFX.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Helper function to synthesize a realistic harmonic bell strike
      const strikeBell = (freq, startTime, duration = 1.4, volume = 0.28) => {
        // Fundamental tone
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, startTime);

        gain1.gain.setValueAtTime(0, startTime);
        gain1.gain.linearRampToValueAtTime(volume, startTime + 0.015); // acoustic strike attack
        gain1.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(startTime);
        osc1.stop(startTime + duration + 0.05);

        // Harmonic overtone (brass/bronze bell shimmer at ~2.01x freq)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2.01, startTime);

        gain2.gain.setValueAtTime(0, startTime);
        gain2.gain.linearRampToValueAtTime(volume * 0.35, startTime + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.0004, startTime + (duration * 0.7));

        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(startTime);
        osc2.stop(startTime + duration);
      };

      // Motif Phase 1 (0.0s - 1.5s): Ascending reminder melody (E5 -> G#5 -> B5 -> E6)
      strikeBell(659.25, now + 0.00, 1.2, 0.26); // E5
      strikeBell(830.61, now + 0.35, 1.2, 0.28); // G#5
      strikeBell(987.77, now + 0.70, 1.3, 0.30); // B5
      strikeBell(1318.51, now + 1.05, 1.6, 0.35); // E6

      // Motif Phase 2 (1.8s - 3.2s): Responding cascade melody (E6 -> B5 -> G#5 -> E5)
      strikeBell(1318.51, now + 1.80, 1.2, 0.30); // E6
      strikeBell(987.77, now + 2.15, 1.2, 0.28); // B5
      strikeBell(830.61, now + 2.50, 1.3, 0.28); // G#5
      strikeBell(659.25, now + 2.85, 1.6, 0.32); // E5

      // Finale Resonance (3.5s - 5.5s): Harmonic sustained triad chord (long bell decay)
      strikeBell(659.25, now + 3.50, 2.2, 0.25); // E5
      strikeBell(987.77, now + 3.50, 2.2, 0.25); // B5
      strikeBell(1318.51, now + 3.50, 2.2, 0.30); // E6
      strikeBell(1661.22, now + 3.50, 2.0, 0.18); // G#6 shimmer
    } catch (e) {
      console.log('Audio error:', e);
    }
  }

  // Success chord when completing task
  static playSuccessChord() {
    if (!soundEnabled) return;
    try {
      const ctx = SoundFX.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.06);
        gain.gain.setValueAtTime(0, now + i * 0.06);
        gain.gain.linearRampToValueAtTime(0.18, now + i * 0.06 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.65);
      });
    } catch (e) {
      console.log('Audio error:', e);
    }
  }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function escapeHtml(text) {
  if (!text) return '';
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getMotivation() {
  const quotes = [
    "Let's focus and execute with precision today.",
    "Prioritize what truly moves the needle.",
    "Small disciplined steps compound into greatness.",
    "Clear deadlines, calm mind, unstoppable momentum.",
    "Eliminate friction and crush your agenda.",
    "Stay organized, stay ahead of the curve."
  ];
  return quotes[Math.floor(Math.random() * quotes.length)];
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

function formatTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatDateTime(d) {
  if (!d) return '';
  return `${formatDate(d)}, ${formatTime(d)}`;
}

function isToday(dateStr) {
  const target = new Date(dateStr);
  const now = new Date();
  return target.getFullYear() === now.getFullYear() &&
         target.getMonth() === now.getMonth() &&
         target.getDate() === now.getDate();
}

function isOverdue(task) {
  if (task.completed) return false;
  return new Date(task.deadline).getTime() < Date.now();
}

function getRelativeTime(dateStr) {
  const diffMs = new Date(dateStr).getTime() - Date.now();
  const abs = Math.abs;
  const mins = Math.round(diffMs / 60000);
  const hrs = Math.round(diffMs / 3600000);
  const days = Math.round(diffMs / 86400000);

  if (diffMs < 0) {
    if (abs(mins) < 60) return `${abs(mins)}m overdue`;
    if (abs(hrs) < 24) return `${abs(hrs)}h overdue`;
    return `${abs(days)}d overdue`;
  }
  if (mins < 1) return 'Due right now';
  if (mins < 60) return `in ${mins}m`;
  if (hrs < 24) return `in ${hrs}h`;
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `in ${days} days`;
  if (days < 30) return `in ${Math.ceil(days / 7)} weeks`;
  return `in ${Math.ceil(days / 30)} months`;
}

// ==========================================
// REMINDER ENGINE & CALCULATIONS
// ==========================================
function calculateReminderTimestamp(mode, deadlineStr, presetMins, offsetVal, offsetUnit, exactStr) {
  if (mode === 'none') return null;

  if (mode === 'exact') {
    if (!exactStr) return null;
    return new Date(exactStr).getTime();
  }

  if (!deadlineStr) return null;
  const deadlineMs = new Date(deadlineStr).getTime();

  if (mode === 'preset') {
    const mins = parseInt(presetMins) || 15;
    return deadlineMs - (mins * 60 * 1000);
  }

  if (mode === 'offset') {
    const val = parseFloat(offsetVal) || 0;
    let multiplier = 60 * 1000;
    if (offsetUnit === 'hours') multiplier = 60 * 60 * 1000;
    if (offsetUnit === 'days') multiplier = 24 * 60 * 60 * 1000;
    return deadlineMs - (val * multiplier);
  }

  return null;
}

function getTaskReminderTime(task) {
  return calculateReminderTimestamp(
    task.reminderMode,
    task.deadline,
    task.reminderPresetMinutes,
    task.reminderOffsetValue,
    task.reminderOffsetUnit,
    task.reminderExact
  );
}

function formatReminderDescription(task) {
  if (task.reminderMode === 'none') return '';
  const timeMs = getTaskReminderTime(task);
  if (!timeMs) return '';

  const formatted = formatDateTime(new Date(timeMs));

  if (task.reminderMode === 'preset') {
    const labels = {
      15: '15m before', 30: '30m before', 60: '1h before', 120: '2h before',
      360: '6h before', 720: '12h before', 1440: '1d before', 2880: '2d before', 10080: '1w before'
    };
    return `${labels[task.reminderPresetMinutes] || 'Preset'} (${formatted})`;
  }

  if (task.reminderMode === 'offset') {
    return `${task.reminderOffsetValue} ${task.reminderOffsetUnit} before (${formatted})`;
  }

  if (task.reminderMode === 'exact') {
    return `Alert: ${formatted}`;
  }

  return formatted;
}

function updateModalReminderPreview() {
  const previewBox = document.getElementById('reminder-preview-box');
  const previewText = document.getElementById('preview-calculated-time');
  const deadlineInput = document.getElementById('task-deadline-input').value;

  if (modalReminderMode === 'none') {
    previewBox.classList.remove('warning');
    previewText.textContent = 'No reminder alert scheduled';
    return;
  }

  const fireTime = calculateReminderTimestamp(
    modalReminderMode,
    deadlineInput,
    modalPresetMinutes,
    modalOffsetValue,
    modalOffsetUnit,
    modalExactTime
  );

  if (!fireTime) {
    previewBox.classList.remove('warning');
    previewText.textContent = modalReminderMode === 'exact' ? 'Select an exact alert date & time above' : 'Specify task deadline to compute reminder';
    return;
  }

  const dateObj = new Date(fireTime);
  const now = Date.now();
  const formatted = `${formatDate(dateObj)} at ${formatTime(dateObj)}`;

  if (fireTime < now) {
    previewBox.classList.add('warning');
    previewText.innerHTML = `⚠️ <strong>${formatted}</strong> (Time is in the past)`;
  } else {
    previewBox.classList.remove('warning');
    const rel = getRelativeTime(dateObj);
    previewText.innerHTML = `🔔 <strong>${formatted}</strong> (${rel})`;
  }
}

// ==========================================
// WEB PUSH SUBSCRIPTION & VAPID HELPERS
// ==========================================
let currentPushSubscription = null;
let vapidPublicKey = null;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function initWebPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[Push] PushManager not supported in this browser');
    return;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (Notification.permission === 'granted') {
      if (!sub) {
        sub = await subscribeToPush(reg);
      } else {
        currentPushSubscription = sub;
        await sendSubscriptionToBackend(sub);
      }
    } else if (sub) {
      currentPushSubscription = sub;
    }
    updateNotificationStatus();
  } catch (err) {
    console.warn('[Push] initWebPush error:', err);
  }
}

async function subscribeToPush(reg) {
  try {
    if (!vapidPublicKey) {
      const res = await fetch('/api/vapid-public-key');
      const data = await res.json();
      vapidPublicKey = data.publicKey;
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });

    currentPushSubscription = sub;
    await sendSubscriptionToBackend(sub);
    console.log('[Push] Subscribed successfully:', sub.endpoint);
    return sub;
  } catch (err) {
    console.error('[Push] subscribeToPush failed:', err);
    return null;
  }
}

async function sendSubscriptionToBackend(subscription) {
  try {
    await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription,
        userAgent: navigator.userAgent
      })
    });
  } catch (err) {
    console.warn('[Push] sendSubscriptionToBackend error:', err);
  }
}

// ==========================================
// BACKEND REMINDER SCHEDULER INTEGRATION
// (Ensures reminders fire even with closed browser & locked phone)
// ==========================================
async function syncBackendReminder(task) {
  if (!task || task.completed || task.reminderMode === 'none') {
    cancelBackendReminder(task?.id);
    return;
  }

  const fireAt = getTaskReminderTime(task);
  if (!fireAt || fireAt <= Date.now()) return;

  try {
    await fetch('/api/schedule-reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: task.id,
        title: task.title,
        deadline: task.deadline,
        reminderTime: new Date(fireAt).toISOString(),
        priority: task.priority,
        channels: task.channels,
        whatsappNumber: task.whatsappNumber,
        email: task.reminderEmail,
        subscription: currentPushSubscription
      })
    });
    console.log(`[Backend Scheduler] Reminder scheduled for "${task.title}" with channels:`, task.channels);
  } catch (err) {
    console.warn('[Backend Scheduler] Failed to schedule reminder:', err);
  }
}

async function cancelBackendReminder(taskId) {
  if (!taskId) return;
  try {
    await fetch(`/api/cancel-reminder/${taskId}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('[Backend Scheduler] Failed to cancel reminder:', err);
  }
}

function syncAllBackendReminders() {
  tasks.forEach(task => {
    if (!task.completed && task.reminderMode !== 'none' && !task.reminderFired) {
      syncBackendReminder(task);
    }
  });
}

// Test Push (Sends high-urgency push after delay so user can lock phone)
async function testBackgroundPush(delaySeconds = 5) {
  if (!('Notification' in window)) {
    showToast('error', '❌', 'Push notifications not supported in this browser');
    return;
  }

  if (Notification.permission !== 'granted') {
    await requestNotificationPermission();
    if (Notification.permission !== 'granted') return;
  }

  if (!currentPushSubscription && 'serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready;
    await subscribeToPush(reg);
  }

  showToast('info', '⏳', `Lock test alert scheduled in ${delaySeconds}s! Lock your phone or close this tab now.`);

  try {
    const res = await fetch('/api/test-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: currentPushSubscription,
        delaySeconds
      })
    });
    const data = await res.json();
    console.log('[Test Push Response]', data);
  } catch (err) {
    showToast('error', '❌', 'Failed to dispatch test push');
  }
}

// ==========================================
// CLIENT REMINDER SCHEDULER & DISPATCHER
// ==========================================
function scheduleAllReminders() {
  Object.values(reminderTimers).forEach(clearTimeout);
  reminderTimers = {};

  tasks.forEach(task => {
    if (task.completed || task.reminderMode === 'none' || task.reminderFired) return;
    scheduleTaskReminder(task);
  });
}

function scheduleTaskReminder(task) {
  const fireAt = getTaskReminderTime(task);
  if (!fireAt) return;

  const delay = fireAt - Date.now();

  if (delay <= 0) {
    if (!task.reminderFired) {
      fireReminderAlert(task);
    }
    return;
  }

  if (delay > 2147483647) return;

  reminderTimers[task.id] = setTimeout(() => {
    fireReminderAlert(task);
  }, delay);
}

function fireReminderAlert(task) {
  task.reminderFired = true;
  saveTasks();

  const channels = task.channels || { push: true, sound: true, calendar: false, whatsapp: false, email: false };

  // Audio Bell Chime — only if sound channel is selected
  if (channels.sound) {
    SoundFX.playReminderChime();
  }

  // Format delivery channels summary
  const deliveredList = [];
  if (channels.push) deliveredList.push('🔔 Push Alert');
  if (channels.sound) deliveredList.push('🔊 Sound Chime');
  if (channels.whatsapp) deliveredList.push(`💬 WhatsApp ${task.whatsappNumber ? `(${task.whatsappNumber})` : ''}`);
  if (channels.email) deliveredList.push(`📧 Email ${task.reminderEmail ? `(${task.reminderEmail})` : ''}`);
  if (channels.calendar) deliveredList.push('📅 Calendar');
  const deliveredViaText = deliveredList.length ? deliveredList.join(' • ') : '🔔 Push Alert';

  const deadlineFormatted = formatDateTime(task.deadline);
  const title = `⏰ Reminder: ${task.title}`;
  const body = `Due ${getRelativeTime(task.deadline)} • Deadline: ${deadlineFormatted}\nDelivered via: ${deliveredViaText}`;

  showToast('reminder', '🔔', `Reminder: "${task.title}"\nDelivered on: ${deliveredViaText}`);

  // Browser Push Notification — only if push channel is selected
  if (channels.push && 'Notification' in window && Notification.permission === 'granted') {
    try {
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          body,
          tag: `taskflow-reminder-${task.id}`,
          data: {
            taskId: task.id,
            deliveredVia: deliveredViaText,
            channels: task.channels,
            whatsappNumber: task.whatsappNumber,
            email: task.reminderEmail
          }
        });
      } else {
        new Notification(title, {
          body,
          icon: './icons/icon-192.png',
          tag: `taskflow-reminder-${task.id}`
        });
      }
    } catch (e) {
      console.warn('Notification trigger error:', e);
    }
  }

  // WhatsApp Quick Note — auto-open if selected
  if (channels.whatsapp) {
    shareTaskToWhatsApp(task.id);
  }

  // Calendar (.ics download) — auto-trigger if selected
  if (channels.calendar) {
    downloadICS(task.id);
  }

  // Email Reminder Template — auto-open mailto if selected
  if (channels.email) {
    emailTaskReminder(task.id);
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('error', '⚠️', 'Notifications are not supported by this browser.');
    return;
  }

  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      showToast('success', '🔔', 'Notifications enabled! You will receive timely task reminders.');
      await registerSW();
      await initWebPush();
    } else if (perm === 'denied') {
      showToast('error', '🔒', 'Notification permission was denied. Enable it in browser site settings.');
    }
    updateNotificationPermissionStatus();
  } catch (err) {
    console.warn('Permission request error:', err);
  }
}

function updateNotificationPermissionStatus() {
  const dot = document.getElementById('notif-status-dot');
  const notifBtn = document.getElementById('header-notif-btn');

  if ('Notification' in window && Notification.permission === 'granted') {
    dot?.classList.add('active');
    notifBtn?.classList.add('active');
  } else {
    dot?.classList.remove('active');
    notifBtn?.classList.remove('active');
  }
}

function updateNotificationStatus() {
  updateNotificationPermissionStatus();
}

// ==========================================
// FREE CHANNELS: WHATSAPP, CALENDAR, EMAIL
// ==========================================
function shareTaskToWhatsApp(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const deadlineText = formatDateTime(task.deadline);
  const msg = 
`📌 *TaskFlow Reminder*
*Task:* ${task.title}
*Deadline:* ${deadlineText} (${getRelativeTime(task.deadline)})
*Priority:* ${task.priority.toUpperCase()}
${task.description ? `*Details:* ${task.description}\n` : ''}
_Managed via TaskFlow Pro_`;

  const phone = (task.whatsappNumber || Store.get('taskflow_whatsapp', '') || '').replace(/[^0-9]/g, '');
  const url = phone 
    ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

  window.open(url, '_blank');
  showToast('info', '💬', phone ? `Opening WhatsApp to +${phone}...` : 'Opening WhatsApp reminder...');
}

function addToGoogleCalendar(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const start = new Date(task.deadline);
  const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 min duration

  const formatGCalDate = d => d.toISOString().replace(/-|:|\.\d\d\d/g, '');

  const details = `${task.description ? task.description + '\n\n' : ''}Priority: ${task.priority}\nManaged in TaskFlow Pro`;
  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(task.title)}&dates=${formatGCalDate(start)}/${formatGCalDate(end)}&details=${encodeURIComponent(details)}`;

  window.open(gcalUrl, '_blank');
  showToast('success', '📅', 'Opening Google Calendar with reminder...');
}

function downloadICS(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const start = new Date(task.deadline);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  const formatICSDate = d => d.toISOString().replace(/-|:|\.\d\d\d/g, '');

  const icsContent = 
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TaskFlow Pro//Task Management//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${task.id}@taskflow.pro
DTSTAMP:${formatICSDate(new Date())}
DTSTART:${formatICSDate(start)}
DTEND:${formatICSDate(end)}
SUMMARY:${task.title}
DESCRIPTION:${task.description ? task.description.replace(/\n/g, '\\n') : ''}
PRIORITY:${task.priority === 'high' ? '1' : task.priority === 'medium' ? '5' : '9'}
BEGIN:VALARM
TRIGGER:-PT30M
ACTION:DISPLAY
DESCRIPTION:Reminder: ${task.title} is due soon!
END:VALARM
END:VEVENT
END:VCALENDAR`;

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${task.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('success', '📥', 'Calendar event downloaded with alarm!');
}

async function emailTaskReminder(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const targetEmail = task.reminderEmail || Store.get('taskflow_email', '') || '';

  // Attempt automated background Gmail dispatch first if configured!
  try {
    const res = await fetch('/api/send-task-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: task.id,
        recipient: targetEmail,
        title: task.title,
        description: task.description,
        deadline: task.deadline,
        priority: task.priority
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('success', '📧', `Automated email & Google Calendar invite sent to ${targetEmail || 'your Gmail'}!`);
      return;
    }
  } catch (err) {
    console.warn('Automated email dispatch fallback:', err);
  }

  // Fallback to mailto: client if automated SMTP is not yet configured
  const subject = encodeURIComponent(`Reminder: ${task.title} [TaskFlow]`);
  const body = encodeURIComponent(
`Hello,

Here is your task reminder:

Task: ${task.title}
Deadline: ${formatDateTime(task.deadline)} (${getRelativeTime(task.deadline)})
Priority: ${task.priority.toUpperCase()}
Details: ${task.description || 'None'}

Managed in TaskFlow Pro.`
  );

  window.location.href = `mailto:${encodeURIComponent(targetEmail)}?subject=${subject}&body=${body}`;
  showToast('info', '📧', targetEmail ? `Opening email for ${targetEmail}...` : 'Opening email client...');
}

// ==========================================
// TASK CRUD
// ==========================================
function saveTasks() {
  Store.set('taskflow_tasks', tasks);
  scheduleAllReminders();
  syncAllBackendReminders();
}

function addTask(data) {
  const task = {
    id: generateId(),
    title: data.title.trim(),
    description: data.description?.trim() || '',
    deadline: data.deadline,
    priority: data.priority || 'medium',
    reminderMode: data.reminderMode || 'none',
    reminderPresetMinutes: data.reminderPresetMinutes || 15,
    reminderOffsetValue: data.reminderOffsetValue || 2,
    reminderOffsetUnit: data.reminderOffsetUnit || 'hours',
    reminderExact: data.reminderExact || '',
    channels: data.channels || { push: true, sound: true, calendar: false, whatsapp: false, email: false },
    whatsappNumber: data.whatsappNumber || null,
    reminderEmail: data.reminderEmail || null,
    completed: false,
    createdAt: new Date().toISOString(),
    reminderFired: false
  };

  tasks.unshift(task);
  saveTasks();
  syncBackendReminder(task);
  renderTasks();
  updateStats();
  showToast('success', '✨', `"${task.title}" added`);
  return task;
}

function updateTask(id, data) {
  const index = tasks.findIndex(t => t.id === id);
  if (index === -1) return;

  tasks[index] = {
    ...tasks[index],
    ...data,
    reminderFired: false
  };

  saveTasks();
  syncBackendReminder(tasks[index]);
  renderTasks();
  updateStats();
  showToast('info', '📝', 'Task updated');
}

function deleteTask(id) {
  const task = tasks.find(t => t.id === id);
  cancelBackendReminder(id);
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderTasks();
  updateStats();
  showToast('error', '🗑️', `"${task?.title || 'Task'}" deleted`);
}

function toggleTaskComplete(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;

  if (task.completed) {
    cancelBackendReminder(id);
  } else {
    syncBackendReminder(task);
  }

  saveTasks();
  renderTasks();
  updateStats();

  if (task.completed) {
    SoundFX.playSuccessChord();
    spawnConfetti();
    showToast('success', '🎉', 'Task finished! Great momentum.');
  }
}

// ==========================================
// RENDERING & UI UPDATES
// ==========================================
function renderTasks() {
  const container = document.getElementById('task-list');
  let list = [...tasks];

  // 1. Filter
  if (currentFilter === 'active') {
    list = list.filter(t => !t.completed && !isOverdue(t));
  } else if (currentFilter === 'today') {
    list = list.filter(t => !t.completed && isToday(t.deadline));
  } else if (currentFilter === 'completed') {
    list = list.filter(t => t.completed);
  } else if (currentFilter === 'overdue') {
    list = list.filter(t => isOverdue(t));
  }

  // 2. Search
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.priority.toLowerCase().includes(q)
    );
  }

  // 3. Sort
  list.sort((a, b) => {
    // Incompleted always on top of completed
    if (a.completed !== b.completed) return a.completed ? 1 : -1;

    if (currentSort === 'deadline-asc') {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    }
    if (currentSort === 'deadline-desc') {
      return new Date(b.deadline).getTime() - new Date(a.deadline).getTime();
    }
    if (currentSort === 'priority-desc') {
      const weight = { high: 3, medium: 2, low: 1 };
      return weight[b.priority] - weight[a.priority];
    }
    if (currentSort === 'created-desc') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return 0;
  });

  if (list.length === 0) {
    container.innerHTML = renderEmptyState();
    renderUpcomingAgenda();
    return;
  }

  container.innerHTML = list.map(renderTaskCard).join('');
  renderUpcomingAgenda();
}

function renderUpcomingAgenda() {
  const container = document.getElementById('upcoming-mini-list');
  if (!container) return;

  const upcoming = tasks
    .filter(t => !t.completed && new Date(t.deadline).getTime() >= Date.now())
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 4);

  if (upcoming.length === 0) {
    container.innerHTML = '<div class="upcoming-empty">No upcoming deadlines scheduled</div>';
    return;
  }

  container.innerHTML = upcoming.map(t => {
    return `
      <div class="upcoming-item" onclick="openEditModal('${t.id}')" title="Click to view/edit" style="cursor: pointer;">
        <span class="upcoming-bullet ${t.priority}"></span>
        <div class="upcoming-info">
          <div class="upcoming-title">${escapeHtml(t.title)}</div>
          <div class="upcoming-time">⏳ ${getRelativeTime(t.deadline)} • ${formatDate(t.deadline)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderTaskChannels(task) {
  const channels = task.channels;
  if (!channels || task.reminderMode === 'none') return '';
  const badges = [];
  if (channels.push) badges.push('<span class="pill-ch" title="Browser & Mobile Push Alert">🔔 Push</span>');
  if (channels.sound) badges.push('<span class="pill-ch" title="Audio Chime">🔊 Sound</span>');
  if (channels.whatsapp) {
    const waText = task.whatsappNumber ? `💬 ${escapeHtml(task.whatsappNumber)}` : '💬 WhatsApp';
    badges.push(`<span class="pill-ch wa" title="WhatsApp recipient: ${escapeHtml(task.whatsappNumber || 'Direct Web')}">${waText}</span>`);
  }
  if (channels.email) {
    const mailText = task.reminderEmail ? `📧 ${escapeHtml(task.reminderEmail)}` : '📧 Email';
    badges.push(`<span class="pill-ch mail" title="Email recipient: ${escapeHtml(task.reminderEmail || 'Default Client')}">${mailText}</span>`);
  }
  if (channels.calendar) badges.push('<span class="pill-ch" title="Calendar Sync">📅 .ics</span>');
  if (badges.length === 0) return '';
  return `<div class="task-channels-pill-row">${badges.join('')}</div>`;
}

function renderTaskCard(task) {
  const overdue = isOverdue(task);
  const reminderDesc = formatReminderDescription(task);
  const diffHours = (new Date(task.deadline).getTime() - Date.now()) / 3600000;
  const isUrgent = !task.completed && diffHours > 0 && diffHours <= 24;

  const priorityLabel = {
    high: 'High',
    medium: 'Medium',
    low: 'Low'
  }[task.priority] || task.priority;

  return `
    <div class="task-card priority-${task.priority} ${task.completed ? 'completed' : ''} ${overdue ? 'overdue-card' : ''}" data-id="${task.id}">
      
      <!-- Col 1: Checkbox -->
      <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="toggleTaskComplete('${task.id}')" title="${task.completed ? 'Mark pending' : 'Mark complete'}"></div>

      <!-- Col 2: Content -->
      <div class="task-content">
        <div class="task-title" onclick="openEditModal('${task.id}')" style="cursor: pointer;" title="Click to edit">${escapeHtml(task.title)}</div>
        ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
      </div>

      <!-- Col 3: Deadline & Urgency -->
      <div class="task-col-deadline">
        <span class="tag-deadline-date">📅 ${formatDate(task.deadline)} ${formatTime(task.deadline)}</span>
        <span class="tag-deadline-rel ${overdue ? 'overdue' : isUrgent ? 'urgent' : ''}">
          ${overdue ? '⚠️' : isUrgent ? '⏳' : '⌛'} ${getRelativeTime(task.deadline)}
        </span>
      </div>

      <!-- Col 4: Priority -->
      <div class="task-col-priority">
        <span class="tag-prio-pill ${task.priority}">${priorityLabel}</span>
      </div>

      <!-- Col 5: Reminder & Channels -->
      <div class="task-col-reminder">
        ${reminderDesc ? `<span class="tag-reminder-chip" title="Alert scheduled: ${reminderDesc}">⏰ ${reminderDesc}</span>` : '<span style="color: var(--text-muted); font-size: 11px;">No alert</span>'}
        ${renderTaskChannels(task)}
      </div>

      <!-- Col 6: Actions -->
      <div class="task-actions">
        <button class="task-action-btn wa" onclick="shareTaskToWhatsApp('${task.id}')" title="Send WhatsApp Reminder">💬</button>
        <button class="task-action-btn cal" onclick="addToGoogleCalendar('${task.id}')" title="Sync to Google Calendar">📅</button>
        <button class="task-action-btn cal" onclick="downloadICS('${task.id}')" title="Download .ics event">📥</button>
        <button class="task-action-btn mail" onclick="emailTaskReminder('${task.id}')" title="Email Reminder">📧</button>
        <button class="task-action-btn" onclick="openEditModal('${task.id}')" title="Edit Task">✏️</button>
        <button class="task-action-btn delete" onclick="confirmDeleteTask('${task.id}')" title="Delete Task">🗑️</button>
      </div>

    </div>
  `;
}

function renderEmptyState() {
  const configs = {
    all:       { icon: '📋', title: 'No tasks scheduled', desc: 'Click "+ New Task" to start organizing your day' },
    active:    { icon: '🎯', title: 'All caught up!',     desc: 'No active tasks pending — enjoy the momentum' },
    today:     { icon: '☀️', title: 'Clear day ahead',     desc: 'No tasks with deadlines scheduled for today' },
    completed: { icon: '🏆', title: 'No completed tasks', desc: 'Finish tasks to see your completed archive here' },
    overdue:   { icon: '✨', title: 'Zero overdue tasks', desc: 'You are completely on track with all deadlines' }
  };

  const c = configs[currentFilter] || configs.all;
  return `
    <div class="empty-state">
      <div class="empty-icon">${c.icon}</div>
      <h3>${c.title}</h3>
      <p>${c.desc}</p>
    </div>
  `;
}

function updateStats() {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const overdue = tasks.filter(t => isOverdue(t)).length;
  const todayCount = tasks.filter(t => !t.completed && isToday(t.deadline)).length;
  const active = tasks.filter(t => !t.completed && !isOverdue(t)).length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-today').textContent = todayCount;
  document.getElementById('stat-completed').textContent = completed;
  document.getElementById('stat-overdue').textContent = overdue;

  // Filter badges
  document.getElementById('badge-all').textContent = total;
  document.getElementById('badge-active').textContent = active;
  document.getElementById('badge-today').textContent = todayCount;
  document.getElementById('badge-completed').textContent = completed;
  document.getElementById('badge-overdue').textContent = overdue;

  // Daily completion progress
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const progressBar = document.getElementById('progress-bar-fill');
  const progressText = document.getElementById('progress-text');
  const progressBadge = document.getElementById('progress-percent-badge');

  if (progressBar) progressBar.style.width = `${progressPercent}%`;
  if (progressText) progressText.textContent = `${completed} of ${total} tasks completed (${progressPercent}%)`;
  if (progressBadge) progressBadge.textContent = `${progressPercent}%`;
}

function updateGreeting() {
  const greetingEl = document.getElementById('greeting-text');
  const nameDisplay = document.getElementById('user-name-display');
  const avatarInitial = document.getElementById('user-avatar-initial');
  const subtitleEl = document.getElementById('greeting-subtitle');

  const name = userName.trim() || 'Productive Champ';

  if (greetingEl) {
    greetingEl.innerHTML = `${getGreeting()}, <span class="greeting-name">${escapeHtml(name)}</span>! <span class="wave">👋</span>`;
  }
  if (nameDisplay) nameDisplay.textContent = name;
  if (avatarInitial) avatarInitial.textContent = name.charAt(0).toUpperCase() || 'U';
  if (subtitleEl) subtitleEl.textContent = getMotivation();
}

function updateCurrentDateBadge() {
  const badge = document.getElementById('current-date-badge');
  if (badge) {
    badge.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  }
}

// ==========================================
// PALETTE & SOUND TOGGLE
// ==========================================
function setPalette(palette) {
  currentPalette = palette;
  document.documentElement.setAttribute('data-theme', palette);
  Store.set('taskflow_palette', palette);

  document.querySelectorAll('.palette-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.palette === palette);
  });
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  Store.set('taskflow_sound', soundEnabled);
  const icon = document.getElementById('sound-icon');
  const btn = document.getElementById('sound-toggle-btn');
  if (icon) icon.textContent = soundEnabled ? '🔊' : '🔇';
  if (btn) btn.title = soundEnabled ? 'Audio Chimes: Enabled' : 'Audio Chimes: Muted';
  showToast('info', soundEnabled ? '🔊' : '🔇', soundEnabled ? 'Audio Chimes enabled' : 'Audio Chimes muted');
  if (soundEnabled) SoundFX.playReminderChime();
}

// ==========================================
// MODAL MANAGEMENT
// ==========================================
function setModalReminderMode(mode) {
  modalReminderMode = mode;

  // Tabs
  document.querySelectorAll('#reminder-mode-tabs .reminder-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });

  // Panels
  document.getElementById('panel-preset')?.classList.toggle('visible', mode === 'preset');
  document.getElementById('panel-offset')?.classList.toggle('visible', mode === 'offset');
  document.getElementById('panel-exact')?.classList.toggle('visible', mode === 'exact');

  updateModalReminderPreview();
}

function openAddModal() {
  editingTaskId = null;
  document.getElementById('modal-title').textContent = 'Create New Task';
  document.getElementById('task-title-input').value = '';
  document.getElementById('task-desc-input').value = '';

  // Default deadline: tomorrow at 5:00 PM
  const def = new Date();
  def.setDate(def.getDate() + 1);
  def.setHours(17, 0, 0, 0);
  const defLocal = new Date(def.getTime() - def.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  document.getElementById('task-deadline-input').value = defLocal;
  document.getElementById('task-priority-input').value = 'medium';

  // Default reminder: Preset 1 hour
  modalPresetMinutes = 60;
  modalOffsetValue = 2;
  modalOffsetUnit = 'hours';
  modalExactTime = '';

  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.minutes === '60');
  });
  document.getElementById('task-offset-value').value = 2;
  document.getElementById('task-offset-unit').value = 'hours';
  document.getElementById('task-reminder-exact').value = '';

  setModalReminderMode('preset');

  // Reset channels to defaults
  modalChannels = { push: true, sound: true, calendar: false, whatsapp: false, email: false };
  syncChannelUI();

  // Pre-fill contact fields from Store defaults
  const waInput = document.getElementById('task-whatsapp-input');
  const mailInput = document.getElementById('task-email-input');
  if (waInput) waInput.value = Store.get('taskflow_whatsapp', '');
  if (mailInput) mailInput.value = Store.get('taskflow_email', '');

  document.getElementById('task-modal').classList.add('active');
  setTimeout(() => document.getElementById('task-title-input').focus(), 150);
}

function openEditModal(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  editingTaskId = id;
  document.getElementById('modal-title').textContent = 'Edit Task';
  document.getElementById('task-title-input').value = task.title;
  document.getElementById('task-desc-input').value = task.description || '';
  document.getElementById('task-deadline-input').value = task.deadline;
  document.getElementById('task-priority-input').value = task.priority;

  modalPresetMinutes = task.reminderPresetMinutes || 15;
  modalOffsetValue = task.reminderOffsetValue || 2;
  modalOffsetUnit = task.reminderOffsetUnit || 'hours';
  modalExactTime = task.reminderExact || '';

  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.classList.toggle('active', parseInt(chip.dataset.minutes) === modalPresetMinutes);
  });
  document.getElementById('task-offset-value').value = modalOffsetValue;
  document.getElementById('task-offset-unit').value = modalOffsetUnit;
  document.getElementById('task-reminder-exact').value = modalExactTime;

  setModalReminderMode(task.reminderMode || 'none');

  // Restore saved channel selections
  modalChannels = task.channels ? { ...task.channels } : { push: true, sound: true, calendar: false, whatsapp: false, email: false };
  syncChannelUI();

  // Restore contact inputs
  const waInput = document.getElementById('task-whatsapp-input');
  const mailInput = document.getElementById('task-email-input');
  if (waInput) waInput.value = task.whatsappNumber || Store.get('taskflow_whatsapp', '');
  if (mailInput) mailInput.value = task.reminderEmail || Store.get('taskflow_email', '');

  document.getElementById('task-modal').classList.add('active');
}

function closeModal() {
  document.getElementById('task-modal').classList.remove('active');
  editingTaskId = null;
}

// ==========================================
// CHANNEL SELECTION UI
// ==========================================
function syncChannelUI() {
  const channelKeys = ['push', 'sound', 'calendar', 'whatsapp', 'email'];
  channelKeys.forEach(key => {
    const checkbox = document.getElementById(`channel-${key}`);
    const label = document.getElementById(`label-channel-${key}`);
    if (checkbox) checkbox.checked = !!modalChannels[key];
    if (label) label.classList.toggle('active', !!modalChannels[key]);
  });

  // Reveal / hide destination contact fields
  const waGroup = document.getElementById('group-channel-whatsapp');
  const mailGroup = document.getElementById('group-channel-email');
  if (waGroup) waGroup.style.display = modalChannels.whatsapp ? 'block' : 'none';
  if (mailGroup) mailGroup.style.display = modalChannels.email ? 'block' : 'none';
}

function toggleChannel(key) {
  modalChannels[key] = !modalChannels[key];
  syncChannelUI();
}

function handleTaskFormSubmit(e) {
  e.preventDefault();

  const title = document.getElementById('task-title-input').value.trim();
  const description = document.getElementById('task-desc-input').value.trim();
  const deadline = document.getElementById('task-deadline-input').value;
  const priority = document.getElementById('task-priority-input').value;

  if (!title || !deadline) {
    showToast('error', '⚠️', 'Please provide a task title and deadline');
    return;
  }

  const whatsappNumber = document.getElementById('task-whatsapp-input')?.value.trim() || '';
  const reminderEmail = document.getElementById('task-email-input')?.value.trim() || '';

  if (whatsappNumber) Store.set('taskflow_whatsapp', whatsappNumber);
  if (reminderEmail) Store.set('taskflow_email', reminderEmail);

  const taskData = {
    title,
    description,
    deadline,
    priority,
    reminderMode: modalReminderMode,
    reminderPresetMinutes: modalPresetMinutes,
    reminderOffsetValue: parseFloat(document.getElementById('task-offset-value').value) || 1,
    reminderOffsetUnit: document.getElementById('task-offset-unit').value,
    reminderExact: document.getElementById('task-reminder-exact').value,
    channels: { ...modalChannels },
    whatsappNumber,
    reminderEmail
  };

  if (editingTaskId) {
    updateTask(editingTaskId, taskData);
  } else {
    addTask(taskData);
  }

  closeModal();
}

// User Profile & Automation Settings Modal
async function openUserModal() {
  document.getElementById('edit-name-input').value = userName;
  const editWa = document.getElementById('edit-whatsapp-input');
  if (editWa) editWa.value = Store.get('taskflow_whatsapp', '');

  // Update calendar feed URL with current origin
  const feedInput = document.getElementById('calendar-feed-url');
  if (feedInput) {
    feedInput.value = `${window.location.origin}/api/calendar.ics`;
  }

  // Fetch email automation status
  try {
    const res = await fetch('/api/email-config');
    const cfg = await res.json();
    const badge = document.getElementById('email-cfg-badge');
    const userField = document.getElementById('cfg-gmail-user');
    if (userField && cfg.user) userField.value = cfg.user;
    if (badge) {
      if (cfg.configured) {
        badge.textContent = 'Active (Connected)';
        badge.classList.add('active');
      } else {
        badge.textContent = 'Not Configured';
        badge.classList.remove('active');
      }
    }
  } catch (err) {
    console.warn('Failed to load email config:', err);
  }

  document.getElementById('user-modal').classList.add('active');
  setTimeout(() => document.getElementById('edit-name-input').focus(), 150);
}

function closeUserModal() {
  document.getElementById('user-modal').classList.remove('active');
}

async function handleUserEditSubmit(e) {
  e.preventDefault();
  const newName = document.getElementById('edit-name-input').value.trim();
  const wa = document.getElementById('edit-whatsapp-input')?.value.trim() || '';
  const gmailUser = document.getElementById('cfg-gmail-user')?.value.trim() || '';
  const gmailPass = document.getElementById('cfg-gmail-pass')?.value.trim() || '';

  if (newName) {
    userName = newName;
    Store.set('taskflow_user', userName);
    updateGreeting();
  }
  if (wa) Store.set('taskflow_whatsapp', wa);

  // If Gmail credentials provided, save them to the backend server
  if (gmailUser && gmailPass) {
    try {
      const res = await fetch('/api/email-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: gmailUser, pass: gmailPass })
      });
      const data = await res.json();
      if (res.ok) {
        Store.set('taskflow_email', gmailUser);
        showToast('success', '📧', 'Automated Gmail delivery enabled!');
      } else {
        showToast('error', '⚠️', data.error || 'Failed to save email settings');
      }
    } catch (err) {
      showToast('error', '⚠️', 'Network error saving email settings');
    }
  } else if (gmailUser) {
    Store.set('taskflow_email', gmailUser);
  }

  showToast('success', '👤', 'Profile and automation settings saved');
  closeUserModal();
}

function copyCalendarFeedUrl() {
  const url = `${window.location.origin}/api/calendar.ics`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('success', '📋', 'Calendar feed URL copied! In Google Calendar: Other calendars (+) > From URL');
  }).catch(() => {
    showToast('info', '📅', url);
  });
}

async function testAutomatedEmail() {
  const gmailUser = document.getElementById('cfg-gmail-user')?.value.trim();
  const gmailPass = document.getElementById('cfg-gmail-pass')?.value.trim();

  // If credentials entered, save config first
  if (gmailUser && gmailPass) {
    await fetch('/api/email-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: gmailUser, pass: gmailPass })
    });
  }

  showToast('info', '⏳', 'Sending test email and Google Calendar invite...');

  try {
    const res = await fetch('/api/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: gmailUser })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('success', '🎉', data.message || 'Test email and Google Calendar invite sent!');
      const badge = document.getElementById('email-cfg-badge');
      if (badge) {
        badge.textContent = 'Active (Connected)';
        badge.classList.add('active');
      }
    } else {
      showToast('error', '❌', data.error || 'Failed to send test email');
    }
  } catch (err) {
    showToast('error', '❌', 'Error sending test email. Check server connection.');
  }
}

// Delete Confirmation
function confirmDeleteTask(id) {
  taskToDeleteId = id;
  document.getElementById('confirm-overlay').classList.add('active');
}

function executeDelete() {
  if (taskToDeleteId) {
    deleteTask(taskToDeleteId);
    taskToDeleteId = null;
  }
  document.getElementById('confirm-overlay').classList.remove('active');
}

function cancelDelete() {
  taskToDeleteId = null;
  document.getElementById('confirm-overlay').classList.remove('active');
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
function showToast(type, icon, message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

// ==========================================
// CONFETTI EFFECT
// ==========================================
function spawnConfetti() {
  const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#a855f7'];
  for (let i = 0; i < 35; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.left = `${Math.random() * 100}vw`;
    el.style.top = `${Math.random() * 40}vh`;
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.transform = `scale(${0.5 + Math.random()})`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }
}

// ==========================================
// SERVICE WORKER REGISTRATION
// ==========================================
async function registerSW() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (e) {
      console.warn('SW registration:', e);
    }
  }
}

// Periodic check every 10 seconds for background/tab reminders
function startPeriodicReminderCheck() {
  setInterval(() => {
    tasks.forEach(task => {
      if (task.completed || task.reminderMode === 'none' || task.reminderFired) return;
      const fireAt = getTaskReminderTime(task);
      if (fireAt && Date.now() >= fireAt) {
        console.log(`[Reminder Trigger] Firing scheduled reminder for "${task.title}"`);
        fireReminderAlert(task);
      }
    });
  }, 10000);
}

// ==========================================
// INITIALIZATION & EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Unlock Web Audio on first user interaction
  const unlockAudio = () => {
    SoundFX.getAudioContext();
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
  };
  document.addEventListener('click', unlockAudio);
  document.addEventListener('keydown', unlockAudio);

  // Apply theme palette
  setPalette(currentPalette);

  // Check user welcome state
  if (!userName) {
    document.getElementById('welcome-overlay')?.classList.remove('hidden');
  } else {
    document.getElementById('welcome-overlay')?.classList.add('hidden');
  }

  // Update UI displays
  updateGreeting();
  updateCurrentDateBadge();
  renderTasks();
  updateStats();

  // Safely initialize notifications and reminders
  try {
    updateNotificationStatus();
    scheduleAllReminders();
    startPeriodicReminderCheck();
    registerSW().then(() => {
      initWebPush();
    }).catch(err => console.warn('[Push] Service worker init error:', err));
  } catch (e) {
    console.warn('[Init] Reminder setup error:', e);
  }

  // Notification Banner check
  if ('Notification' in window && Notification.permission === 'default') {
    document.getElementById('notif-banner')?.classList.remove('hidden');
  }

  // Sound Icon
  const soundIcon = document.getElementById('sound-icon');
  if (soundIcon) soundIcon.textContent = soundEnabled ? '🔊' : '🔇';

  // Palette pickers
  document.querySelectorAll('.palette-btn').forEach(btn => {
    btn.addEventListener('click', () => setPalette(btn.dataset.palette));
  });

  // Sound toggle
  document.getElementById('sound-toggle-btn')?.addEventListener('click', toggleSound);

  // Welcome Form
  document.getElementById('welcome-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const nameInput = document.getElementById('welcome-name-input').value.trim();
    if (nameInput) {
      userName = nameInput;
      Store.set('taskflow_user', userName);
      document.getElementById('welcome-overlay').classList.add('hidden');
      updateGreeting();
      showToast('success', '👋', `Welcome aboard, ${userName}!`);
    }
  });

  // User Profile & Automation Settings Modal
  document.getElementById('user-pill')?.addEventListener('click', openUserModal);
  document.getElementById('user-edit-form')?.addEventListener('submit', handleUserEditSubmit);
  document.getElementById('btn-test-email')?.addEventListener('click', testAutomatedEmail);

  // Task Form & FAB
  document.getElementById('task-form')?.addEventListener('submit', handleTaskFormSubmit);
  document.getElementById('fab')?.addEventListener('click', openAddModal);
  document.getElementById('header-add-btn')?.addEventListener('click', openAddModal);

  // Modal Backdrop Click
  document.getElementById('task-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('user-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeUserModal();
  });

  // Search & Filters
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear-btn');

  searchInput?.addEventListener('input', e => {
    searchQuery = e.target.value;
    searchClear.classList.toggle('hidden', !searchQuery);
    renderTasks();
  });

  searchClear?.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.classList.add('hidden');
    renderTasks();
  });

  function setFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === filter);
    });

    const titles = {
      all: 'All Tasks',
      active: 'In Progress Tasks',
      today: "Today's Agenda",
      overdue: 'Overdue Deadlines',
      completed: 'Completed Tasks'
    };

    const titleEl = document.getElementById('current-view-title');
    if (titleEl) titleEl.textContent = titles[filter] || 'Tasks';

    renderTasks();
  }

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setFilter(btn.dataset.filter);
      // Close mobile sidebar if open
      sidebar?.classList.remove('open');
      backdrop?.classList.remove('active');
    });
  });

  // Stat Cards Click to Filter
  document.querySelectorAll('.stat-card').forEach(card => {
    card.addEventListener('click', () => {
      const filter = card.dataset.filterTrigger;
      if (filter) setFilter(filter);
    });
  });

  // Quick Inline Task Creator (Press Enter to add instantly)
  const quickInput = document.getElementById('quick-task-input');
  quickInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const text = quickInput.value.trim();
      if (!text) return;

      const def = new Date();
      def.setDate(def.getDate() + 1);
      def.setHours(17, 0, 0, 0);
      const defLocal = new Date(def.getTime() - def.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

      addTask({
        title: text,
        description: '',
        deadline: defLocal,
        priority: 'medium',
        reminderMode: 'preset',
        reminderPresetMinutes: 15,
        reminderOffsetValue: 2,
        reminderOffsetUnit: 'hours',
        reminderExact: ''
      });

      quickInput.value = '';
    }
  });

  document.getElementById('quick-detailed-btn')?.addEventListener('click', openAddModal);

  // Mobile Sidebar Drawer
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    sidebar?.classList.add('open');
    backdrop?.classList.add('active');
  });

  const closeSidebar = () => {
    sidebar?.classList.remove('open');
    backdrop?.classList.remove('active');
  };

  document.getElementById('sidebar-close-btn')?.addEventListener('click', closeSidebar);
  backdrop?.addEventListener('click', closeSidebar);

  // Desktop Sidebar Collapse Toggle
  const sidebarCollapseBtn = document.getElementById('sidebar-collapse-btn');
  const isSidebarCollapsed = Store.get('taskflow_sidebar_collapsed');
  if (isSidebarCollapsed) {
    sidebar?.classList.add('collapsed');
  }

  sidebarCollapseBtn?.addEventListener('click', () => {
    sidebar?.classList.toggle('collapsed');
    Store.set('taskflow_sidebar_collapsed', sidebar?.classList.contains('collapsed'));
  });

  // Sort Selector
  document.getElementById('sort-select')?.addEventListener('change', e => {
    currentSort = e.target.value;
    renderTasks();
  });

  // Reminder Mode Tabs
  document.querySelectorAll('#reminder-mode-tabs .reminder-tab').forEach(tab => {
    tab.addEventListener('click', () => setModalReminderMode(tab.dataset.mode));
  });

  // Preset Chips
  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      modalPresetMinutes = parseInt(chip.dataset.minutes) || 15;
      updateModalReminderPreview();
    });
  });

  // Offset Inputs
  document.getElementById('task-offset-value')?.addEventListener('input', e => {
    modalOffsetValue = parseFloat(e.target.value) || 1;
    updateModalReminderPreview();
  });
  document.getElementById('task-offset-unit')?.addEventListener('change', e => {
    modalOffsetUnit = e.target.value;
    updateModalReminderPreview();
  });

  // Exact Datetime Input
  document.getElementById('task-reminder-exact')?.addEventListener('input', e => {
    modalExactTime = e.target.value;
    updateModalReminderPreview();
  });

  // Deadline Input change triggers reminder preview update
  document.getElementById('task-deadline-input')?.addEventListener('input', () => {
    updateModalReminderPreview();
  });

  // Banner & Push Test actions
  document.getElementById('notif-enable-btn')?.addEventListener('click', requestNotificationPermission);
  document.getElementById('notif-test-btn')?.addEventListener('click', () => testBackgroundPush(5));
  document.getElementById('header-test-push-btn')?.addEventListener('click', () => testBackgroundPush(5));
  document.getElementById('sidebar-test-push-btn')?.addEventListener('click', () => testBackgroundPush(5));
  document.getElementById('notif-dismiss-btn')?.addEventListener('click', () => {
    document.getElementById('notif-banner')?.classList.add('hidden');
  });

  // Confirm delete dialog buttons
  document.getElementById('confirm-yes')?.addEventListener('click', executeDelete);
  document.getElementById('confirm-no')?.addEventListener('click', cancelDelete);
  document.getElementById('confirm-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) cancelDelete();
  });

  // Global Keybindings (Escape to close, N to create new task)
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      closeUserModal();
      cancelDelete();
    }
    if ((e.key === 'n' || e.key === 'N') && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      openAddModal();
    }
  });

  // Live timer for greeting & date
  setInterval(updateGreeting, 60000);
});
