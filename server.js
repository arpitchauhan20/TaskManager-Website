/* ==========================================================================
   TaskFlow Pro — Full-Stack Server & Resend HTTPS Email Dispatcher
   ========================================================================== */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const webpush = require('web-push');
const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');
const sendEmailHandler = require('./api/send-email');
const calendarFeedHandler = require('./api/calendar');

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize Resend HTTPS Client
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'TaskFlow Pro <onboarding@resend.dev>';
const resendClient = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

app.use(cors());
app.use(express.json());

// Explicit Service Worker & PWA Manifest Routes (Must serve with correct headers)
const DIST_DIR = path.join(__dirname, 'dist');

app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  const swDist = path.join(DIST_DIR, 'sw.js');
  if (fs.existsSync(swDist)) {
    return res.sendFile(swDist);
  }
  const swPublic = path.join(__dirname, 'public', 'sw.js');
  if (fs.existsSync(swPublic)) {
    return res.sendFile(swPublic);
  }
  return res.sendFile(path.join(__dirname, 'sw.js'));
});

app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  const mfDist = path.join(DIST_DIR, 'manifest.json');
  if (fs.existsSync(mfDist)) {
    return res.sendFile(mfDist);
  }
  const mfPublic = path.join(__dirname, 'public', 'manifest.json');
  if (fs.existsSync(mfPublic)) {
    return res.sendFile(mfPublic);
  }
  return res.sendFile(path.join(__dirname, 'manifest.json'));
});

// Mount Resend HTTPS API endpoints (Port 443 — bypasses ISP blocks)
app.post('/api/send-email', sendEmailHandler);
app.post('/api/test-email', sendEmailHandler);

// Serve React production build from dist if available, else root
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
} else {
  app.use(express.static(__dirname));
}

// ==========================================
// PERSISTENCE DIRECTORY SETUP
// ==========================================
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'subscriptions.json');
const REMINDERS_FILE = path.join(DATA_DIR, 'reminders.json');
const EMAIL_CONFIG_FILE = path.join(DATA_DIR, 'email_config.json');

// Helper to safely load JSON
function loadJSON(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return fallback;
}

// Helper to safely write JSON
function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

// ==========================================
// EMAIL & GMAIL AUTOMATION SETUP
// ==========================================
let emailConfig = loadJSON(EMAIL_CONFIG_FILE, {
  service: 'gmail',
  user: '',
  pass: '',
  fromName: 'TaskFlow Pro'
});

let etherealAccount = null;

async function getTransporter() {
  if (emailConfig.user && emailConfig.pass) {
    return {
      transporter: nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: emailConfig.user,
          pass: emailConfig.pass.replace(/\s+/g, '') // remove spaces
        },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000
      }),
      isGmail: true,
      sender: emailConfig.user
    };
  }

  // Fallback: instant test SMTP account so testing works with ZERO configuration
  try {
    if (!etherealAccount) {
      etherealAccount = await nodemailer.createTestAccount();
      console.log('[Email Dispatcher] Instant test SMTP account ready:', etherealAccount.user);
    }
    return {
      transporter: nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: etherealAccount.user,
          pass: etherealAccount.pass
        },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000
      }),
      isGmail: false,
      sender: etherealAccount.user
    };
  } catch (err) {
    console.warn('[Email Dispatcher] Could not create test SMTP:', err.message);
    return null;
  }
}

// Helper: Generate RFC 5545 iCalendar Invitation setting ONLY the reminder date and time
function generateICSInvite(task) {
  const formatICSDate = d => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
  const now = new Date();

  const deadlineStart = task.deadline ? new Date(task.deadline) : new Date(now.getTime() + 3600000);
  const taskId = task.taskId || task.id || Date.now();
  const cleanTitle = (task.title || 'Task Reminder').replace(/[\r\n]/g, ' ');
  const cleanDesc = (task.description || 'Scheduled via TaskFlow Pro').replace(/\r?\n/g, '\\n');
  const priorityStr = (task.priority || 'medium').toUpperCase();

  // Calculate reminder event timing (only reminder date & time is scheduled in calendar)
  let reminderStartMs = task.reminderTime;
  if (!reminderStartMs) {
    if (task.reminderMode === 'preset') {
      const m = parseInt(task.reminderPresetMinutes, 10) || 15;
      reminderStartMs = deadlineStart.getTime() - m * 60000;
    } else if (task.reminderMode === 'exact' && task.reminderExact) {
      reminderStartMs = new Date(task.reminderExact).getTime();
    } else if (task.reminderMode === 'offset') {
      const val = parseFloat(task.reminderOffsetValue) || 1;
      const unit = task.reminderOffsetUnit || 'hours';
      const multipliers = { minutes: 60000, hours: 3600000, days: 86400000 };
      reminderStartMs = deadlineStart.getTime() - val * (multipliers[unit] || 3600000);
    } else {
      reminderStartMs = deadlineStart.getTime() - 15 * 60000; // Default 15 min before
    }
  }
  const reminderStart = new Date(reminderStartMs);
  const reminderEnd = new Date(reminderStart.getTime() + 30 * 60 * 1000); // 30 min duration

  return [
    'BEGIN:VCALENDAR',
    'PRODID:-//TaskFlow Pro//Reminder Calendar Engine//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',

    // --- SCHEDULED REMINDER EVENT ONLY ---
    'BEGIN:VEVENT',
    `UID:taskflow_${taskId}@taskflow.pro`,
    `DTSTAMP:${formatICSDate(now)}`,
    `DTSTART:${formatICSDate(reminderStart)}`,
    `DTEND:${formatICSDate(reminderEnd)}`,
    `SUMMARY:⏰ Reminder: ${cleanTitle}`,
    `DESCRIPTION:TaskFlow Reminder for "${cleanTitle}"\\nDeadline: ${deadlineStart.toLocaleString()}\\nPriority: ${priorityStr}\\n\\n${cleanDesc}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT0M',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${cleanTitle}`,
    'END:VALARM',
    'END:VEVENT',

    'END:VCALENDAR'
  ].join('\r\n');
}

// Automated Email Dispatcher (Sends real email with Google Calendar sync invite)
async function sendAutomatedEmail(recipient, task, isTest = false) {
  const targetRecipient = recipient || emailConfig.user || 'arpitchauhan5586@gmail.com';
  const icsContent = generateICSInvite(task);
  const icsBase64 = Buffer.from(icsContent).toString('base64');
  const deadlineStr = task.deadline ? new Date(task.deadline).toLocaleString() : 'Not specified';
  const priorityStr = (task.priority || 'medium').toUpperCase();

  // 1. Try Resend HTTPS API First (Port 443 — 100% reliable across any ISP/network)
  if (resendClient) {
    try {
      const { data, error } = await resendClient.emails.send({
        from: FROM_EMAIL,
        to: [targetRecipient],
        subject: isTest ? '✅ TaskFlow Pro — Email & Google Calendar Test' : `⏰ Task Reminder: ${task.title} [TaskFlow]`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #334155;">
            <div style="background: linear-gradient(135deg, #6366f1, #4f46e5); padding: 22px 28px;">
              <h1 style="margin: 0; font-size: 20px; color: #ffffff; font-weight: 700;">TaskFlow Pro Reminder</h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: rgba(255,255,255,0.88);">Automated Notification & Google Calendar Event</p>
            </div>
            <div style="padding: 24px 28px;">
              <div style="background: #1e293b; border-radius: 8px; padding: 18px 20px; border-left: 4px solid #6366f1; margin-bottom: 20px;">
                <h2 style="margin: 0 0 8px 0; font-size: 17px; color: #f1f5f9;">${task.title}</h2>
                ${task.description ? `<p style="margin: 0 0 10px 0; font-size: 13px; color: #94a3b8;">${task.description}</p>` : ''}
                <div style="font-size: 13px; color: #cbd5e1; line-height: 1.6;">
                  <p style="margin: 4px 0;"><strong>📅 Deadline:</strong> ${deadlineStr}</p>
                  <p style="margin: 4px 0;"><strong>⚡ Priority:</strong> <span style="font-weight: 700; color: #f59e0b;">${priorityStr}</span></p>
                </div>
              </div>
              <div style="background: rgba(37, 211, 102, 0.08); border: 1px solid rgba(37, 211, 102, 0.3); border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #4ade80;">
                📅 <strong>Google Calendar Sync:</strong> An invite (.ics) is attached to this email. Gmail / Google Calendar automatically detects this and adds it to your calendar.
              </div>
            </div>
            <div style="background: #090d16; padding: 14px 28px; font-size: 11px; color: #64748b; text-align: center;">
              Sent automatically by TaskFlow Pro • <a href="https://task-manager-website-psi.vercel.app" style="color: #818cf8; text-decoration: none;">task-manager-website-psi.vercel.app</a>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: 'invite.ics',
            content: icsBase64
          }
        ]
      });

      if (error) {
        console.error('[Email Dispatcher] Resend API returned error:', error);
      } else {
        console.log(`[Email Dispatcher] Automated email sent via Resend HTTPS to ${targetRecipient}: ${data.id}`);
        return { success: true, messageId: data.id, isResend: true };
      }
    } catch (resendErr) {
      console.warn('[Email Dispatcher] Resend API threw exception:', resendErr.message);
    }
  }

  // 2. Fallback to Nodemailer transporter
  const transportInfo = await getTransporter();
  if (!transportInfo) {
    console.log('[Email Dispatcher] Skipped: No email transporter available.');
    return { success: false, reason: 'No email transporter available' };
  }

  const { transporter, isGmail, sender } = transportInfo;
  const fromAddress = isGmail ? `"${emailConfig.fromName || 'TaskFlow Pro'}" <${emailConfig.user}>` : `"TaskFlow Pro" <${sender}>`;

  const mailOptions = {
    from: fromAddress,
    to: targetRecipient,
    subject: isTest ? '✅ TaskFlow Pro — Email & Google Calendar Test' : `⏰ Task Reminder: ${task.title} [TaskFlow]`,
    text: `TaskFlow Reminder\n\nTask: ${task.title}\nDeadline: ${deadlineStr}\nPriority: ${priorityStr}\n\nNote: Google Calendar will automatically add this event.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #334155;">
        <div style="background: linear-gradient(135deg, #6366f1, #4f46e5); padding: 22px 28px;">
          <h1 style="margin: 0; font-size: 20px; color: #ffffff; font-weight: 700;">TaskFlow Pro Reminder</h1>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: rgba(255,255,255,0.88);">Automated Notification & Google Calendar Event</p>
        </div>
        <div style="padding: 24px 28px;">
          <div style="background: #1e293b; border-radius: 8px; padding: 18px 20px; border-left: 4px solid #6366f1; margin-bottom: 20px;">
            <h2 style="margin: 0 0 8px 0; font-size: 17px; color: #f1f5f9;">${task.title}</h2>
            ${task.description ? `<p style="margin: 0 0 10px 0; font-size: 13px; color: #94a3b8;">${task.description}</p>` : ''}
            <div style="font-size: 13px; color: #cbd5e1; line-height: 1.6;">
              <p style="margin: 4px 0;"><strong>📅 Deadline:</strong> ${deadlineStr}</p>
              <p style="margin: 4px 0;"><strong>⚡ Priority:</strong> <span style="font-weight: 700; color: #f59e0b;">${priorityStr}</span></p>
            </div>
          </div>
          <div style="background: rgba(37, 211, 102, 0.08); border: 1px solid rgba(37, 211, 102, 0.3); border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #4ade80;">
            📅 <strong>Google Calendar Sync:</strong> A calendar invitation is attached. Gmail / Google Calendar will automatically add this event to your calendar.
          </div>
        </div>
        <div style="background: #090d16; padding: 14px 28px; font-size: 11px; color: #64748b; text-align: center;">
          Sent automatically by TaskFlow Pro • <a href="https://task-manager-website-psi.vercel.app" style="color: #818cf8; text-decoration: none;">task-manager-website-psi.vercel.app</a>
        </div>
      </div>
    `,
    icalEvent: {
      filename: 'invite.ics',
      method: 'request',
      content: icsContent
    },
    alternatives: [{
      contentType: 'text/calendar; method=REQUEST; charset=UTF-8',
      content: icsContent
    }]
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    const previewUrl = !isGmail ? nodemailer.getTestMessageUrl(info) : null;
    console.log(`[Email Dispatcher] Automated email sent to ${targetRecipient}: ${info.messageId}`);
    return { success: true, messageId: info.messageId, previewUrl, isGmail };
  } catch (err) {
    console.error(`[Email Dispatcher] Failed to send email via SMTP:`, err.message);
    return { 
      success: false, 
      error: err.message, 
      rawError: err.message 
    };
  }
}

// ==========================================
// VAPID KEYS CONFIGURATION
// ==========================================
let vapidKeys = loadJSON(VAPID_FILE, null);
if (!vapidKeys || !vapidKeys.publicKey || !vapidKeys.privateKey) {
  console.log('Generating new VAPID keys...');
  vapidKeys = webpush.generateVAPIDKeys();
  saveJSON(VAPID_FILE, vapidKeys);
}

webpush.setVapidDetails(
  'mailto:admin@taskflow.pro',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

console.log('VAPID Public Key:', vapidKeys.publicKey);

// In-memory caches backed by disk
let subscriptions = loadJSON(SUBSCRIPTIONS_FILE, []);
let reminders = loadJSON(REMINDERS_FILE, []);

// ==========================================
// API ENDPOINTS
// ==========================================

// 1. Get VAPID Public Key
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

// 2. Register / Update Push Subscription
app.post('/api/subscribe', (req, res) => {
  const { subscription, userAgent } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid push subscription' });
  }

  // Deduplicate by endpoint
  const existingIndex = subscriptions.findIndex(s => s.endpoint === subscription.endpoint);
  const subRecord = {
    ...subscription,
    userAgent: userAgent || '',
    updatedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    subscriptions[existingIndex] = subRecord;
  } else {
    subscriptions.push(subRecord);
  }

  saveJSON(SUBSCRIPTIONS_FILE, subscriptions);
  console.log(`[Push] Device subscribed. Total active subscriptions: ${subscriptions.length}`);
  res.status(201).json({ success: true, count: subscriptions.length });
});

// 3. Schedule Reminder for Task
app.post('/api/schedule-reminder', (req, res) => {
  const { taskId, title, deadline, reminderTime, priority, subscription, channels, whatsappNumber, email } = req.body;

  if (!taskId || !title || !reminderTime) {
    return res.status(400).json({ error: 'Missing required reminder parameters' });
  }

  const fireAtMs = new Date(reminderTime).getTime();
  if (isNaN(fireAtMs)) {
    return res.status(400).json({ error: 'Invalid reminderTime format' });
  }

  // Remove any existing reminder for this taskId
  reminders = reminders.filter(r => r.taskId !== taskId);

  // Format human-readable destination channels summary
  const activeChannels = channels || { push: true, sound: true, calendar: false, whatsapp: false, email: false };
  const targetSummary = [];
  if (activeChannels.push) targetSummary.push('Browser & Mobile Push');
  if (activeChannels.sound) targetSummary.push('Audio Bell');
  if (activeChannels.whatsapp) targetSummary.push(`WhatsApp (${whatsappNumber || 'Direct Web'})`);
  if (activeChannels.email) targetSummary.push(`Email (${email || 'Default Client'})`);
  if (activeChannels.calendar) targetSummary.push('Calendar (.ics)');

  const newReminder = {
    id: 'rem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    taskId,
    title,
    deadline,
    reminderTime: fireAtMs,
    priority: priority || 'medium',
    channels: activeChannels,
    whatsappNumber: whatsappNumber || null,
    email: email || null,
    receivedOn: targetSummary.join(' • '),
    subscriptionEndpoint: subscription ? subscription.endpoint : null,
    createdAt: new Date().toISOString(),
    fired: false
  };

  reminders.push(newReminder);
  saveJSON(REMINDERS_FILE, reminders);

  console.log(`[Scheduler] Reminder scheduled for task "${title}" at ${new Date(fireAtMs).toLocaleString()} | Destination: ${newReminder.receivedOn}`);

  res.status(200).json({ success: true, reminder: newReminder });
});

// 3b. View All Active & Dispatched Reminders (with delivery targets & channels)
app.get('/api/reminders', (req, res) => {
  res.json({
    total: reminders.length,
    active: reminders.filter(r => !r.fired).length,
    fired: reminders.filter(r => r.fired).length,
    reminders
  });
});

// 3c. EMAIL & GMAIL AUTOMATION API
app.get('/api/email-config', (req, res) => {
  res.json({
    configured: Boolean(emailConfig.user && emailConfig.pass),
    user: emailConfig.user || '',
    fromName: emailConfig.fromName || 'TaskFlow Pro'
  });
});

app.post('/api/email-config', (req, res) => {
  const { user, pass, fromName } = req.body;
  if (!user || !pass) {
    return res.status(400).json({ error: 'Gmail address and 16-character App Password are required' });
  }

  emailConfig = {
    service: 'gmail',
    user: user.trim(),
    pass: pass.trim().replace(/\s+/g, ''),
    fromName: fromName ? fromName.trim() : 'TaskFlow Pro'
  };

  saveJSON(EMAIL_CONFIG_FILE, emailConfig);
  console.log(`[Email Config] Configured automated Gmail account: ${emailConfig.user}`);
  res.json({ success: true, message: 'Gmail automated delivery successfully configured' });
});

// 3d. Test Email & Calendar Delivery
app.post('/api/test-email', async (req, res) => {
  const recipient = req.body.recipient || emailConfig.user;
  if (!recipient) {
    return res.status(400).json({ error: 'No recipient email specified and no default configured' });
  }

  const testTask = {
    taskId: 'test_invite_' + Date.now(),
    title: 'TaskFlow Pro — Live Integration Test',
    description: 'This is an automated test confirming that TaskFlow Pro can deliver emails directly to your Gmail and automatically add events to your Google Calendar.',
    deadline: new Date(Date.now() + 2 * 3600000).toISOString(),
    priority: 'high'
  };

  const result = await sendAutomatedEmail(recipient, testTask, true);
  if (result.success) {
    res.json({ success: true, message: `Test email & Google Calendar invite sent to ${recipient}!` });
  } else {
    res.status(500).json({ error: result.error || result.reason || 'Failed to dispatch email' });
  }
});

// 3e. Send Immediate Task Email
app.post('/api/send-task-email', async (req, res) => {
  const { taskId, recipient, title, description, deadline, priority } = req.body;
  const targetRecipient = recipient || emailConfig.user;

  if (!targetRecipient) {
    return res.status(400).json({ error: 'Recipient email required. Configure Gmail in Profile Settings.' });
  }

  const taskObj = { taskId: taskId || 'task_' + Date.now(), title, description, deadline, priority };
  const result = await sendAutomatedEmail(targetRecipient, taskObj, false);

  if (result.success) {
    res.json({ success: true, message: `Automated email and calendar invite sent to ${targetRecipient}` });
  } else {
    res.status(500).json({ error: result.error || result.reason || 'Failed to send automated email' });
  }
});

// 3f. Live iCalendar Subscription Feed (for Google Calendar / Outlook / Apple Calendar)
// Users can subscribe to this URL in Google Calendar once, and it syncs continuously!
app.get('/api/calendar.ics', (req, res) => {
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TaskFlow Pro//Live Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:TaskFlow Pro Deadlines',
    'X-WR-TIMEZONE:UTC'
  ];

  const formatICSDate = d => d.toISOString().replace(/-|:|\.\d\d\d/g, '');

  for (const rem of reminders) {
    if (rem.fired) continue;
    const start = new Date(rem.deadline);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    ics.push('BEGIN:VEVENT');
    ics.push(`UID:${rem.taskId}@taskflow.pro`);
    ics.push(`DTSTAMP:${formatICSDate(new Date())}`);
    ics.push(`DTSTART:${formatICSDate(start)}`);
    ics.push(`DTEND:${formatICSDate(end)}`);
    ics.push(`SUMMARY:⏰ ${rem.title}`);
    ics.push(`DESCRIPTION:TaskFlow Deadline: ${new Date(rem.deadline).toLocaleString()}\\nPriority: ${rem.priority.toUpperCase()}`);
    ics.push('STATUS:CONFIRMED');
    ics.push('BEGIN:VALARM');
    ics.push('TRIGGER:-PT15M');
    ics.push('ACTION:DISPLAY');
    ics.push(`DESCRIPTION:Reminder: ${rem.title}`);
    ics.push('END:VALARM');
    ics.push('END:VEVENT');
  }

  ics.push('END:VCALENDAR');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="taskflow.ics"');
  res.send(ics.join('\r\n'));
});

// 4. Cancel Reminder for Task (e.g. task completed or deleted)
app.delete('/api/cancel-reminder/:taskId', (req, res) => {
  const { taskId } = req.params;
  const initialCount = reminders.length;
  reminders = reminders.filter(r => r.taskId !== taskId);

  if (reminders.length !== initialCount) {
    saveJSON(REMINDERS_FILE, reminders);
    console.log(`[Scheduler] Reminder cancelled for taskId: ${taskId}`);
  }

  res.json({ success: true });
});

// 5. Send Immediate Test Push Notification (with optional delay for lock screen testing)
app.post('/api/test-push', async (req, res) => {
  const { subscription, delaySeconds } = req.body;

  const targetSub = subscription || subscriptions[subscriptions.length - 1];
  if (!targetSub) {
    return res.status(400).json({ error: 'No active push subscription found to test' });
  }

  const delayMs = (parseInt(delaySeconds) || 0) * 1000;

  const payload = JSON.stringify({
    title: '🔒 TaskFlow Background Alert',
    body: delaySeconds > 0
      ? `Received successfully! Web Push woke your phone after a ${delaySeconds}s delay.`
      : 'Web Push is active and ready to alert you even with your browser closed!',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: 'taskflow-test-push',
    data: {
      url: './index.html',
      timestamp: Date.now()
    }
  });

  const sendNotification = async () => {
    try {
      await webpush.sendNotification(targetSub, payload, {
        TTL: 86400,
        urgency: 'high'
      });
      console.log('[Test Push] Sent test notification successfully');
    } catch (err) {
      console.error('[Test Push] Failed to send notification:', err.statusCode, err.body || err.message);
      // If subscription expired or was unregistered (410 / 404), clean it up
      if (err.statusCode === 410 || err.statusCode === 404) {
        subscriptions = subscriptions.filter(s => s.endpoint !== targetSub.endpoint);
        saveJSON(SUBSCRIPTIONS_FILE, subscriptions);
      }
    }
  };

  if (delayMs > 0) {
    setTimeout(sendNotification, delayMs);
    res.json({
      success: true,
      message: `Push notification scheduled in ${delaySeconds} seconds. You can now close the browser and lock your phone!`
    });
  } else {
    await sendNotification();
    res.json({ success: true, message: 'Push notification sent immediately.' });
  }
});

// ==========================================
// BACKGROUND REMINDER SCHEDULER
// ==========================================
async function checkAndDispatchReminders() {
  const now = Date.now();
  const due = reminders.filter(r => !r.fired && r.reminderTime <= now);

  if (due.length === 0) return;

  console.log(`[Scheduler] Found ${due.length} reminder(s) due for dispatch`);

  for (const reminder of due) {
    reminder.fired = true;

    // Find subscription for this reminder
    let targets = [];
    if (reminder.subscriptionEndpoint) {
      const specific = subscriptions.find(s => s.endpoint === reminder.subscriptionEndpoint);
      if (specific) targets.push(specific);
    }
    // Fallback to all known subscriptions if specific not found
    if (targets.length === 0) {
      targets = subscriptions;
    }

    // Automatically dispatch email & Google Calendar invite if email or calendar channel is enabled
    if (reminder.channels?.email || reminder.channels?.calendar) {
      const emailTarget = reminder.email || emailConfig.user;
      if (emailTarget) {
        sendAutomatedEmail(emailTarget, reminder);
      }
    }

    if (targets.length === 0) {
      console.warn(`[Scheduler] No push subscription available for reminder "${reminder.title}"`);
      continue;
    }

      const destinationText = reminder.receivedOn ? `\nReceived via: ${reminder.receivedOn}` : '';

      const payload = JSON.stringify({
        title: `⏰ Reminder: ${reminder.title}`,
        body: `Deadline: ${new Date(reminder.deadline).toLocaleString()} • Priority: ${reminder.priority.toUpperCase()}${destinationText}`,
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        tag: `reminder-${reminder.taskId}`,
        data: {
          taskId: reminder.taskId,
          url: './index.html',
          deadline: reminder.deadline,
          receivedOn: reminder.receivedOn || 'Push Alert',
          channels: reminder.channels,
          whatsappNumber: reminder.whatsappNumber,
          email: reminder.email
        }
      });

      for (const sub of targets) {
        try {
          await webpush.sendNotification(sub, payload, {
            TTL: 86400,
            urgency: 'high'
          });
          console.log(`[Scheduler] Dispatched push for "${reminder.title}" to ${sub.endpoint.slice(0, 30)}...`);
        } catch (err) {
          console.error(`[Scheduler] Failed to dispatch push for "${reminder.title}":`, err.statusCode, err.message);
          if (err.statusCode === 410 || err.statusCode === 404) {
            subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
            saveJSON(SUBSCRIPTIONS_FILE, subscriptions);
          }
        }
      }
    }

    // Remove fired reminders that are older than 2 days to keep store clean
    const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;
    reminders = reminders.filter(r => !(r.fired && r.reminderTime < twoDaysAgo));
    saveJSON(REMINDERS_FILE, reminders);
  }

  // Poll reminders every 10 seconds
  setInterval(checkAndDispatchReminders, 10000);

  // SPA Fallback: send index.html from dist if available, else root
  app.get('*', (req, res) => {
    if (fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    } else {
      res.sendFile(path.join(__dirname, 'index.html'));
    }
  });

  // ==========================================
  // START SERVER
  // ==========================================
  app.listen(PORT, () => {
    console.log(`
=========================================================
  TaskFlow Pro Server Running
  URL: http://localhost:${PORT}
  VAPID Public Key: ${vapidKeys.publicKey}
  Active Subscriptions: ${subscriptions.length}
  Pending Reminders: ${reminders.filter(r => !r.fired).length}
=========================================================
  `);
  });
