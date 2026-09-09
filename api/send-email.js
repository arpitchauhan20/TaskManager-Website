const { Resend } = require('resend');

// Helper: RFC 5545 iCalendar Invitation generator setting ONLY the reminder date and time
function generateICSInvite(task) {
  const formatICSDate = d => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
  const now = new Date();

  const deadlineStart = task.deadline ? new Date(task.deadline) : new Date(now.getTime() + 3600000);
  const taskId = task.taskId || task.id || Date.now();
  const cleanTitle = (task.title || 'Task Reminder').replace(/[\r\n]/g, ' ');
  const cleanDesc = (task.description || '').replace(/\r?\n/g, '\\n');
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

  const { recipient, title, description, deadline, priority, isTest } = req.body || {};
  const targetRecipient = recipient || 'arpitchauhan5586@gmail.com';

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || 'TaskFlow Pro <onboarding@resend.dev>';

  if (!apiKey) {
    return res.status(500).json({ error: 'RESEND_API_KEY is not configured in environment variables' });
  }

  const resend = new Resend(apiKey);
  const taskObj = {
    taskId: req.body.taskId || 'task_' + Date.now(),
    title: title || 'TaskFlow Pro Live Test',
    description: description || '',
    deadline: deadline || new Date(Date.now() + 3600000).toISOString(),
    priority: priority || 'high'
  };

  const icsContent = generateICSInvite(taskObj);
  const icsBase64 = Buffer.from(icsContent).toString('base64');
  const deadlineStr = taskObj.deadline ? new Date(taskObj.deadline).toLocaleString() : 'Not specified';
  const priorityStr = (taskObj.priority || 'medium').toUpperCase();

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #334155;">
      <div style="background: linear-gradient(135deg, #6366f1, #4f46e5); padding: 22px 28px;">
        <h1 style="margin: 0; font-size: 20px; color: #ffffff; font-weight: 700;">TaskFlow Pro Reminder</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: rgba(255,255,255,0.88);">Automated Notification & Google Calendar Event</p>
      </div>
      <div style="padding: 24px 28px;">
        <div style="background: #1e293b; border-radius: 8px; padding: 18px 20px; border-left: 4px solid #6366f1; margin-bottom: 20px;">
          <h2 style="margin: 0 0 8px 0; font-size: 17px; color: #f1f5f9;">${taskObj.title}</h2>
          ${taskObj.description ? `<p style="margin: 0 0 10px 0; font-size: 13px; color: #94a3b8;">${taskObj.description}</p>` : ''}
          <div style="font-size: 13px; color: #cbd5e1; line-height: 1.6;">
            <p style="margin: 4px 0;"><strong>📅 Deadline:</strong> ${deadlineStr}</p>
            <p style="margin: 4px 0;"><strong>⚡ Priority:</strong> <span style="font-weight: 700; color: #f59e0b;">${priorityStr}</span></p>
          </div>
        </div>
        <div style="background: rgba(37, 211, 102, 0.08); border: 1px solid rgba(37, 211, 102, 0.3); border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #4ade80;">
          📅 <strong>Google Calendar Sync:</strong> An invite (.ics) is attached to this email. Google Calendar will automatically add this event to your calendar.
        </div>
      </div>
      <div style="background: #090d16; padding: 14px 28px; font-size: 11px; color: #64748b; text-align: center;">
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
