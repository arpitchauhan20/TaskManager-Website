const { Resend } = require('resend');

// Helper: RFC 5545 iCalendar Invitation setting the DEADLINE date and time with reminder VALARM
function generateICSInvite(task, recipientEmail) {
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
  const attendeeEmail = recipientEmail || '';

  return [
    'BEGIN:VCALENDAR',
    'PRODID:-//Techy Tool//Deadline Calendar Engine//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',

    // --- SCHEDULED DEADLINE EVENT WITH EMBEDDED REMINDER ALARM ---
    'BEGIN:VEVENT',
    `UID:techytool_${taskId}@techytool.pro`,
    `DTSTAMP:${formatICSDate(now)}`,
    `DTSTART:${formatICSDate(deadlineStart)}`,
    `DTEND:${formatICSDate(deadlineEnd)}`,
    `SUMMARY:🎯 Deadline: ${cleanTitle}`,
    `DESCRIPTION:Task: ${cleanTitle}\\nDeadline: ${deadlineStart.toLocaleString()}\\nPriority: ${priorityStr}\\n\\n${cleanDesc}\\n\\nManaged via Techy Tool`,
    'ORGANIZER;CN="Techy Tool":mailto:onboarding@resend.dev',
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=TRUE;CN="${attendeeEmail}":mailto:${attendeeEmail}`,
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
    `Task: ${task.title || ''}\nDeadline: ${deadlineStart.toLocaleString()}\nPriority: ${(task.priority || 'medium').toUpperCase()}${task.description ? '\n\n' + task.description : ''}\n\nManaged via Techy Tool`
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatGCalDate(deadlineStart)}/${formatGCalDate(deadlineEnd)}&details=${details}`;
}

// Helper: Sanitize & format Resend 'from' address to prevent 422 validation errors
function resolveFromEmail(raw) {
  const fallback = 'Techy Tool <onboarding@resend.dev>';
  if (!raw || typeof raw !== 'string') return fallback;

  let cleaned = raw.trim();
  if (cleaned.startsWith('FROM_EMAIL=')) {
    cleaned = cleaned.replace(/^FROM_EMAIL=/, '').trim();
  }
  cleaned = cleaned.replace(/^["'`]+|["'`]+$/g, '').trim();

  if (!cleaned) return fallback;

  const matchWithAngle = cleaned.match(/^([^<]*)<([^>]+)>$/);
  if (matchWithAngle) {
    const namePart = matchWithAngle[1].trim();
    const emailPart = matchWithAngle[2].trim();
    const finalName = namePart ? namePart.replace(/[^\w\s.-]/g, '') : 'Techy Tool';
    return `${finalName} <${emailPart}>`;
  }

  return `Techy Tool <${cleaned}>`;
}

module.exports = async (req, res) => {
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

  const {
    recipient,
    title,
    description,
    deadline,
    priority,
    reminderTime,
    isTest,
    type,
    requesterName,
    requesterEmail,
    targetName,
    targetEmail,
    friendName,
    friendEmail,
    senderName,
    senderEmail
  } = req.body || {};

  const targetRecipient = (recipient || process.env.ADMIN_EMAIL || 'arpitchauhan5586@gmail.com').trim();

  if (!targetRecipient) {
    return res.status(400).json({ error: 'Recipient email address is required.' });
  }

  const rawApiKey = process.env.RESEND_API_KEY || '';
  const apiKey = rawApiKey.trim().replace(/^["'`]+|["'`]+$/g, '');
  const fromEmail = resolveFromEmail(process.env.FROM_EMAIL);

  if (!apiKey) {
    return res.status(500).json({ error: 'RESEND_API_KEY is not configured in environment variables' });
  }

  const resend = new Resend(apiKey);

  // Check if this is an "Add User" / "Access Request" email
  const isAddUserRequest =
    type === 'add_user_request' ||
    type === 'request_access' ||
    Boolean(targetEmail || friendEmail) ||
    (typeof title === 'string' && title.toLowerCase().includes('access request'));

  if (isAddUserRequest) {
    const sName = (requesterName || senderName || 'Executive User').trim();
    const sEmail = (requesterEmail || senderEmail || 'Not provided').trim();
    const tName = (targetName || friendName || '').trim();
    const tEmail = (targetEmail || friendEmail || '').trim();

    if (!tEmail) {
      return res.status(400).json({ error: 'Target user email address is required.' });
    }

    const submittedAt = new Date().toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'medium'
    });

    const subject = `👤 [Action Required] Add User Request: ${tName || 'New User'} (${tEmail}) from ${sName}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0b0f19; color: #f8fafc; border-radius: 14px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%); padding: 26px 32px;">
          <div style="display: inline-block; background: rgba(0, 0, 0, 0.25); color: #ffffff; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 8px;">
            👤 User Access Request
          </div>
          <h1 style="margin: 0; font-size: 22px; color: #ffffff; font-weight: 800; letter-spacing: -0.02em;">
            New Request to Add User
          </h1>
          <p style="margin: 6px 0 0 0; font-size: 13.5px; color: rgba(255, 255, 255, 0.9);">
            An executive user has requested to add a user to Google OAuth &amp; workspace access.
          </p>
        </div>

        <div style="padding: 28px 30px;">
          <!-- 2 Column Highlight Cards -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 22px;">
            <tr>
              <!-- Sender Box -->
              <td width="48%" valign="top" style="background: #131b2e; border: 1px solid #1e293b; border-radius: 10px; padding: 16px 18px;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #818cf8; letter-spacing: 0.05em; margin-bottom: 8px;">
                  📤 Requested By (Sender)
                </div>
                <div style="font-size: 15px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">
                  ${sName}
                </div>
                <div style="font-size: 12.5px; color: #94a3b8; word-break: break-all;">
                  <a href="mailto:${sEmail}" style="color: #93c5fd; text-decoration: none;">${sEmail}</a>
                </div>
              </td>

              <td width="4%"></td>

              <!-- Target User Box -->
              <td width="48%" valign="top" style="background: #172033; border: 1px solid #3b82f6; border-radius: 10px; padding: 16px 18px; box-shadow: 0 0 15px rgba(59, 130, 246, 0.15);">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #38bdf8; letter-spacing: 0.05em; margin-bottom: 8px;">
                  📥 Person to Add (Invitee)
                </div>
                <div style="font-size: 15px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">
                  ${tName || 'Not specified'}
                </div>
                <div style="font-size: 12.5px; color: #94a3b8; word-break: break-all;">
                  <a href="mailto:${tEmail}" style="color: #38bdf8; font-weight: 700; text-decoration: none;">${tEmail}</a>
                </div>
              </td>
            </tr>
          </table>

          <!-- Summary Table -->
          <div style="background: #0e1424; border: 1px solid #1e293b; border-radius: 10px; padding: 18px; margin-bottom: 22px;">
            <h3 style="margin: 0 0 12px 0; font-size: 13.5px; font-weight: 700; color: #f1f5f9;">
              📋 Request Overview
            </h3>
            <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 13px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="color: #64748b; width: 42%; padding: 7px 4px;">Sender Name:</td>
                <td style="color: #f8fafc; font-weight: 600; padding: 7px 4px;">${sName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="color: #64748b; padding: 7px 4px;">Sender Gmail / Email:</td>
                <td style="color: #93c5fd; font-family: monospace; font-size: 12px; padding: 7px 4px;">${sEmail}</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="color: #64748b; padding: 7px 4px;">Invited Person Name:</td>
                <td style="color: #f8fafc; font-weight: 600; padding: 7px 4px;">${tName || 'Not specified'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="color: #64748b; padding: 7px 4px;">Invited Gmail Address:</td>
                <td style="color: #38bdf8; font-weight: 700; font-family: monospace; font-size: 12.5px; padding: 7px 4px;">${tEmail}</td>
              </tr>
              <tr>
                <td style="color: #64748b; padding: 7px 4px;">Submitted At:</td>
                <td style="color: #94a3b8; font-size: 12px; padding: 7px 4px;">${submittedAt}</td>
              </tr>
            </table>
          </div>

          <!-- Admin Quick Action Steps -->
          <div style="background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.25); border-radius: 10px; padding: 16px 18px;">
            <h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #a5b4fc;">
              ⚡ Steps to Grant Google OAuth Access:
            </h4>
            <ol style="margin: 0; padding-left: 20px; font-size: 12px; color: #cbd5e1; line-height: 1.6;">
              <li>Open <strong>Google Cloud Console</strong> &rarr; <em>APIs & Services</em> &rarr; <em>OAuth consent screen</em>.</li>
              <li>Under <strong>Test users</strong>, click <strong>+ ADD USERS</strong>.</li>
              <li>Paste the Gmail: <code style="background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #38bdf8; font-weight: 600;">${tEmail}</code> and click <strong>Save</strong>.</li>
            </ol>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #060911; padding: 14px 30px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #1e293b;">
          TaskFlow Pro • Executive Access Management
        </div>
      </div>
    `;

    try {
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: [targetRecipient],
        subject,
        html
      });

      if (error) {
        console.error('[Resend Error]', error);
        return res.status(400).json({ error: error.message || 'Failed to send email via Resend' });
      }

      console.log('[Resend Success] Add User Request email sent. ID:', data.id);
      return res.status(200).json({
        success: true,
        message: `Add user request sent for ${tEmail}!`,
        id: data.id
      });
    } catch (err) {
      console.error('[Resend Exception]', err);
      return res.status(500).json({ error: err.message || 'Server error sending email' });
    }
  }

  // Otherwise, Standard Task Reminder Email with Calendar Attachment (.ics)
  const taskObj = {
    taskId: req.body.taskId || 'task_' + Date.now(),
    title: title || 'Techy Tool Live Test',
    description: description || '',
    deadline: deadline || new Date(Date.now() + 3600000).toISOString(),
    priority: priority || 'high',
    reminderTime: reminderTime
  };

  const deadlineStart = new Date(taskObj.deadline);
  const deadlineEnd = new Date(deadlineStart.getTime() + 30 * 60 * 1000);
  const gcalUrl = getGoogleCalendarUrl(taskObj, deadlineStart, deadlineEnd);

  const icsContent = generateICSInvite(taskObj, targetRecipient);
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
        <h1 style="margin: 0; font-size: 22px; color: #ffffff; font-weight: 700; letter-spacing: -0.02em;">Techy Tool Reminder</h1>
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
        Sent automatically by Techy Tool
      </div>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [targetRecipient],
      subject: isTest ? 'Techy Tool: Live Resend & Google Calendar Test' : `Task Reminder: ${taskObj.title} [Techy Tool]`,
      html,
      attachments: [
        {
          filename: 'invite.ics',
          content: icsBase64,
          content_type: 'text/calendar; method=REQUEST; charset=UTF-8'
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
