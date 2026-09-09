// ==========================================
// TaskFlow Pro — Reminder & Push Sync Service
// Handles Web Push, Service Worker & Persistent Backend Scheduling
// ==========================================

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

export function calculateReminderTimeMs(task) {
  if (!task.deadline || !task.reminderMode || task.reminderMode === 'none') {
    return null;
  }

  const deadlineMs = new Date(task.deadline).getTime();
  if (isNaN(deadlineMs)) return null;

  if (task.reminderMode === 'preset') {
    const mins = parseInt(task.reminderPresetMinutes, 10) || 15;
    return deadlineMs - mins * 60 * 1000;
  }

  if (task.reminderMode === 'offset') {
    const val = parseFloat(task.reminderOffsetValue) || 1;
    const unit = task.reminderOffsetUnit || 'hours';
    const multipliers = { minutes: 60 * 1000, hours: 3600 * 1000, days: 86400 * 1000 };
    return deadlineMs - val * (multipliers[unit] || 3600 * 1000);
  }

  if (task.reminderMode === 'exact' && task.reminderExact) {
    const exactMs = new Date(task.reminderExact).getTime();
    return isNaN(exactMs) ? null : exactMs;
  }

  return deadlineMs - 15 * 60 * 1000;
}

export async function initPushSubscription() {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Push] Service workers or push notifications are not supported by this browser.');
    return null;
  }

  try {
    // 1. Register service worker
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    // 2. Check permission
    if (Notification.permission === 'denied') {
      console.warn('[Push] Notification permission was denied by user.');
      return null;
    }

    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return null;
    }

    // 3. Fetch server VAPID key
    const vapidRes = await fetch('/api/vapid-public-key');
    if (!vapidRes.ok) throw new Error('Could not fetch VAPID public key');
    const { publicKey } = await vapidRes.json();

    // 4. Subscribe to Push Manager
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }

    // 5. Send subscription to server
    await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription,
        userAgent: navigator.userAgent
      })
    });

    console.log('[Push] Successfully subscribed device to backend push dispatcher!');
    return subscription;
  } catch (err) {
    console.warn('[Push] Push registration notice:', err.message);
    return null;
  }
}

export async function scheduleBackendReminder(task, { subscription, defaultEmail } = {}) {
  const reminderTime = calculateReminderTimeMs(task);
  if (!reminderTime) {
    // No reminder set or disabled
    return { success: false, reason: 'No reminder time configured' };
  }

  try {
    const res = await fetch('/api/schedule-reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: task.id,
        title: task.title,
        deadline: task.deadline,
        reminderTime,
        priority: task.priority || 'medium',
        subscription: subscription || null,
        channels: task.channels || { push: true, sound: true, calendar: true, email: false },
        email: task.reminderEmail || defaultEmail || null
      })
    });

    const data = await res.json();
    return data;
  } catch (err) {
    console.error('[Scheduler] Failed to sync reminder to backend:', err);
    return { success: false, error: err.message };
  }
}

export async function cancelBackendReminder(taskId) {
  if (!taskId) return;
  try {
    await fetch(`/api/cancel-reminder/${taskId}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('[Scheduler] Could not cancel backend reminder:', err);
  }
}
