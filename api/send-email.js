const { Resend } = require('resend');

// Helper: RFC 5545 iCalendar Invitation setting the DEADLINE date and time with reminder VALARM
function generateICSInvite(task) {
  const formatICSDate = d => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
  const now = new Date();

  const deadlineStart = task.deadline ? new Date(task.deadline) : new Date(now.getTime() + 3600000);
  const deadlineEnd = new Date(deadlineStart.getTime() + 30 * 60 * 1000); // 30 min duration
  const taskId = task.taskId || task.id || Date.now();
  const cleanTitle = (task.title || 'Task Reminder').replace(/[\r\n]/g, ' ');
  const cleanDesc = (task.description || '').replace(/\r?\n/g, '\\n');
  const priorityStr = (task.priority || 'medium').toUpperCase();

  // Calculate reminder timing to set accurate alarm offset before deadline
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

  // Calculate alarm trigger offset in minutes before deadline
  const offsetMinutes = Math.max(0, Math.round((deadlineStart.getTime() - reminderStartMs) / 60000));

  return [
    'BEGIN:VCALENDAR',
    'PRODID:-//TaskFlow Pro//Deadline Calendar Engine//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',

    // --- SCHEDULED DEADLINE EVENT WITH EMBEDDED REMINDER ALARM ---
    'BEGIN:VEVENT',
    `UID:taskflow_${taskId}@taskflow.pro`,
    `DTSTAMP:${formatICSDate(now)}`,
    `DTSTART:${formatICSDate(deadlineStart)}`,
    `DTEND:${formatICSDate(deadlineEnd)}`,
    `SUMMARY:🎯 Deadline: ${cleanTitle}`,
    `DESCRIPTION:Task: ${cleanTitle}\\nDeadline: ${deadlineStart.toLocaleString()}\\nPriority: ${priorityStr}\\n\\n${cleanDesc}\\n\\nManaged via TaskFlow Pro`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    `TRIGGER:-PT${offsetMinutes}M`,
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${cleanTitle} (Deadline: ${deadlineStart.toLocaleTimeString()})`,
    'END:VALARM',
    'END:VEVENT',

    'END:VCALENDAR'
  ].join('\r\n');
}

// Helper to generate direct 1-click Google Calendar URL for the deadline date and time
function getGoogleCalendarUrl(task, deadlineStart, deadlineEnd) {
  const formatGCalDate = d => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
  const title = encodeURIComponent(`🎯 Deadline: ${task.title || 'Task Reminder'}`);
  const details = encodeURIComponent(
    `Task: ${task.title || ''}\nDeadline: ${deadlineStart.toLocaleString()}\nPriority: ${(task.priority || 'medium').toUpperCase()}${task.description ? '\n\n' + task.description : ''}\n\nManaged via TaskFlow Pro: https://task-manager-website-psi.vercel.app`
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatGCalDate(deadlineStart)}/${formatGCalDate(deadlineEnd)}&details=${details}`;
}

// Helper: Sanitize & format Resend 'from' address to prevent 422 validation errors
function resolveFromEmail(raw) {
  const fallback = 'TaskFlow Pro <onboarding@resend.dev>';
  if (!raw || typeof raw !== 'string') return fallback;

  let cleaned = raw.trim();
  // Strip leading variable assignment if user pasted 'FROM_EMAIL=...' in Vercel value field
  if (cleaned.startsWith('FROM_EMAIL=')) {
    cleaned = cleaned.replace(/^FROM_EMAIL=/, '').trim();
  }
  // Strip surrounding quotes or backticks (", ', `)
  cleaned = cleaned.replace(/^["'`]+|["'`]+$/g, '').trim();

  if (!cleaned) return fallback;

  // Pattern 1: Name <email@domain.com>
  const matchWithAngle = cleaned.match(/^([^<]*)<([^>]+)>$/);
  if (matchWithAngle) {
    const name = matchWithAngle[1].trim();
    const email = matchWithAngle[2].trim();
    if (email && email.includes('@')) {
      return name ? `${name} <${email}>` : email;
    }
  }

  // Pattern 2: Pure email address without angle brackets: email@domain.com
  if (cleaned.includes('@') && !cleaned.includes('<') && !cleaned.includes('>')) {
    return `TaskFlow Pro <${cleaned}>`;
  }

  // Pattern 3: User only entered a name without an email address
  if (!cleaned.includes('@')) {
    return `${cleaned} <onboarding@resend.dev>`;
  }

  return fallback;
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { recipient, title, description, deadline, priority, reminderTime, isTest } = req.body || {};
  const targetRecipient = recipient || 'arpitchauhan5586@gmail.com';

  const rawApiKey = process.env.RESEND_API_KEY || '';
  const apiKey = rawApiKey.trim().replace(/^["'`]+|["'`]+$/g, '');
  const fromEmail = resolveFromEmail(process.env.FROM_EMAIL);

  if (!apiKey) {
    return res.status(500).json({ error: 'RESEND_API_KEY is not configured in environment variables' });
  }

  const resend = new Resend(apiKey);
  const taskObj = {
    taskId: req.body.taskId || 'task_' + Date.now(),
    title: title || 'TaskFlow Pro Live Test',
    description: description || '',
    deadline: deadline || new Date(Date.now() + 3600000).toISOString(),
    priority: priority || 'high',
    reminderTime: reminderTime
  };

  const deadlineStart = new Date(taskObj.deadline);
  const deadlineEnd = new Date(deadlineStart.getTime() + 30 * 60 * 1000);
  const gcalUrl = getGoogleCalendarUrl(taskObj, deadlineStart, deadlineEnd);

  const icsContent = generateICSInvite(taskObj);
  const icsBase64 = Buffer.from(icsContent).toString('base64');
  const deadlineStr = taskObj.deadline ? deadlineStart.toLocaleString() : 'Not specified';
  const priorityStr = (taskObj.priority || 'medium').toUpperCase();

  let remMs = taskObj.reminderTime;
  if (!remMs) {
    remMs = deadlineStart.getTime() - 15 * 60000;
  }
  const reminderStr = new Date(remMs).toLocaleString();

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 14px; overflow: hidden; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.4);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #6366f1, #4f46e5); padding: 24px 30px;">
        <h1 style="margin: 0; font-size: 22px; color: #ffffff; font-weight: 700; letter-spacing: -0.02em;">TaskFlow Pro Reminder</h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: rgba(255,255,255,0.85);">Task Reminder & Google Calendar Sync</p>
      </div>

      <div style="padding: 26px 30px;">
        <!-- Task Details Card -->
        <div style="background: #1e293b; border-radius: 10px; padding: 20px 22px; border-left: 4px solid #6366f1; margin-bottom: 22px;">
          <h2 style="margin: 0 0 10px 0; font-size: 18px; color: #f8fafc; font-weight: 600;">${taskObj.title}</h2>
          ${taskObj.description ? `<p style="margin: 0 0 14px 0; font-size: 14px; color: #94a3b8; line-height: 1.5;">${taskObj.description}</p>` : ''}
          <div style="font-size: 13px; color: #cbd5e1; line-height: 1.7;">
            <p style="margin: 4px 0;"><strong>🎯 Deadline:</strong> <span style="color: #38bdf8; font-weight: 600;">${deadlineStr}</span></p>
            <p style="margin: 4px 0;"><strong>⏰ Reminder Alert:</strong> <span style="color: #f43f5e; font-weight: 600;">${reminderStr}</span></p>
            <p style="margin: 4px 0;"><strong>⚡ Priority:</strong> <span style="font-weight: 700; color: #f59e0b;">${priorityStr}</span></p>
          </div>
        </div>

        <!-- 1-Click Option: Set Reminder on Google Calendar -->
        <div style="background: #131d31; border: 1px solid #283756; border-radius: 10px; padding: 20px; text-align: center; margin-bottom: 20px;">
          <p style="margin: 0 0 14px 0; font-size: 14px; color: #cbd5e1; font-weight: 500;">
            Set this task and reminder on your calendar for the deadline:
          </p>
          <a href="${gcalUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #2563eb); color: #ffffff; font-weight: 600; font-size: 14px; padding: 12px 26px; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">
            📅 Set Reminder on Calendar for Deadline
          </a>
          <p style="margin: 10px 0 0 0; font-size: 11px; color: #64748b;">
            Click above to open Google Calendar with deadline date (${deadlineStr}) & reminder alert
          </p>
        </div>

        <div style="background: rgba(37, 211, 102, 0.08); border: 1px solid rgba(37, 211, 102, 0.25); border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #4ade80;">
          📎 <strong>Calendar File (.ics):</strong> An invitation file is also attached to sync directly with Apple Calendar, Google Calendar, or Outlook.
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #090d16; padding: 16px 30px; font-size: 11px; color: #64748b; text-align: center;">
        Sent automatically by TaskFlow Pro • <a href="https://task-manager-website-psi.vercel.app" style="color: #818cf8; text-decoration: none;">task-manager-website-psi.vercel.app</a>
      </div>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [targetRecipient],
      subject: isTest ? '✅ TaskFlow Pro — Live Resend & Google Calendar Test' : `⏰ Task Reminder: ${taskObj.title} [TaskFlow]`,
      html,
      attachments: [
        {
          filename: 'invite.ics',
          content: icsBase64
        }
      ]
    });

    if (error) {
      console.error('[Resend Error]', error);
      return res.status(400).json({ error: error.message || 'Failed to send email via Resend' });
    }

    console.log('[Resend Success] Sent email ID:', data.id);
    return res.status(200).json({
      success: true,
      message: `Automated email & Google Calendar invite sent to ${targetRecipient}!`,
      id: data.id
    });
  } catch (err) {
    console.error('[Resend Exception]', err);
    return res.status(500).json({ error: err.message || 'Server error sending email' });
  }
};
