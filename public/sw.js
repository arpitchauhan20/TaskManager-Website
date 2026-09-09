/* ==========================================================================
   TaskFlow Pro — Executive Service Worker
   Web Push with Vibration, Audio Bells, WhatsApp, and Google Calendar Action Hooks
   Works 100% when browser is closed, tab is shut down, or phone screen is locked
   ========================================================================== */

const CACHE_NAME = 'taskflow-pro-v6';

// Install — activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate — claim clients immediately and clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — Network-first strategy for dynamic React SPA & API requests
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ==========================================
// WEB PUSH NOTIFICATION EVENT HANDLER
// (Triggers even when browser is closed & phone is locked)
// ==========================================
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Web Push event received:', event);

  let data = {
    title: '⏰ TaskFlow Pro Reminder',
    body: 'You have an upcoming task deadline!',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: 'taskflow-reminder-' + Date.now(),
    data: { url: './' }
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const extra = data.data || {};
  const actions = [
    { action: 'open', title: '👀 Open Task' }
  ];

  if (extra.whatsappNumber || extra.channels?.whatsapp) {
    actions.push({ action: 'whatsapp', title: '💬 WhatsApp' });
  }

  if (extra.channels?.calendar || !extra.channels) {
    actions.push({ action: 'calendar', title: '📅 Calendar' });
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    vibrate: [500, 200, 500, 200, 500, 200, 800], // Intense triple pulse wake
    tag: data.tag || 'taskflow-reminder-' + Date.now(),
    renotify: true,
    requireInteraction: true,
    silent: false, // Forces device system notification chime / bell to ring!
    data: extra,
    actions: actions
  };

  event.waitUntil(
    self.registration.showNotification(data.title, notificationOptions)
  );
});

// ==========================================
// NOTIFICATION CLICK / ACTION DISPATCHER
// ==========================================
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click action:', event.action);
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const extra = event.notification.data || {};

  // Action: Open WhatsApp directly with pre-formatted reminder note
  if (event.action === 'whatsapp') {
    const rawPhone = extra.whatsappNumber || '7347363524';
    const cleanPhone = String(rawPhone).replace(/[^0-9]/g, '');
    const title = event.notification.title || 'Task Reminder';
    const body = event.notification.body || '';
    const msg = `*${title}*\n${body}\n\n_Managed automatically via TaskFlow Pro_`;
    const waUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    event.waitUntil(
      self.clients.openWindow ? self.clients.openWindow(waUrl) : Promise.resolve()
    );
    return;
  }

  // Action: Open Google Calendar directly to save/view event
  if (event.action === 'calendar') {
    const title = encodeURIComponent(event.notification.title || 'TaskFlow Deadline');
    const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}`;
    event.waitUntil(
      self.clients.openWindow ? self.clients.openWindow(calUrl) : Promise.resolve()
    );
    return;
  }

  // Default Action: Open/Focus TaskFlow App and play executive chime
  const targetUrl = extra.url || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'TASKFLOW_ALERT_OPENED',
            task: extra
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ==========================================
// IN-APP MESSAGE LISTENER (from React client)
// ==========================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, data } = event.data;
    self.registration.showNotification(title || '⏰ TaskFlow Pro Reminder', {
      body: body || 'You have an upcoming task deadline!',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      vibrate: [500, 200, 500, 200, 500, 200, 800],
      tag: tag || 'taskflow-reminder-' + Date.now(),
      renotify: true,
      requireInteraction: true,
      silent: false,
      data: data || { url: './' },
      actions: [
        { action: 'open', title: '👀 Open Task' },
        { action: 'whatsapp', title: '💬 WhatsApp' },
        { action: 'calendar', title: '📅 Calendar' }
      ]
    });
  }
});
