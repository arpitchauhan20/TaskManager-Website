// ==========================================
// Google Calendar & iCalendar (.ics) Service
// ==========================================

export function formatGCalDate(date) {
  const d = new Date(date);
  return d.toISOString().replace(/-|:|\.\d\d\d/g, '');
}

export function openGoogleCalendar(task) {
  const start = new Date(task.deadline);
  const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 min duration
  const deadlineTitle = encodeURIComponent(`🎯 Deadline: ${task.title}`);
  const details = encodeURIComponent(
    `${task.description ? task.description + '\n\n' : ''}Priority: ${(task.priority || 'medium').toUpperCase()}\nManaged via TaskFlow Pro`
  );

  // 1. Google Calendar event for DEADLINE
  const urlDeadline = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${deadlineTitle}&dates=${formatGCalDate(start)}/${formatGCalDate(end)}&details=${details}`;
  window.open(urlDeadline, '_blank', 'noopener,noreferrer');

  // 2. Google Calendar event for REMINDER ALERT
  let remMs = task.reminderTime;
  if (!remMs) {
    if (task.reminderMode === 'preset') {
      const m = parseInt(task.reminderPresetMinutes, 10) || 15;
      remMs = start.getTime() - m * 60000;
    } else if (task.reminderMode === 'exact' && task.reminderExact) {
      remMs = new Date(task.reminderExact).getTime();
    } else {
      remMs = start.getTime() - 15 * 60000; // 15 min before
    }
  }

  if (remMs && Math.abs(remMs - start.getTime()) > 60000) {
    const remStart = new Date(remMs);
    const remEnd = new Date(remStart.getTime() + 15 * 60 * 1000);
    const remTitle = encodeURIComponent(`⏰ Reminder Alert: ${task.title}`);
    const remDetails = encodeURIComponent(
      `Upcoming Task Reminder: ${task.title}\nDeadline is at: ${start.toLocaleString()}\nPriority: ${(task.priority || 'medium').toUpperCase()}`
    );
    const urlReminder = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${remTitle}&dates=${formatGCalDate(remStart)}/${formatGCalDate(remEnd)}&details=${remDetails}`;

    setTimeout(() => {
      window.open(urlReminder, '_blank', 'noopener,noreferrer');
    }, 450);
  }
}

export function downloadICS(task) {
  const now = new Date();
  const formatICS = d => d.toISOString().replace(/-|:|\.\d\d\d/g, '');

  const start = new Date(task.deadline);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const taskId = task.id || Date.now();
  const cleanTitle = (task.title || 'task').replace(/[\r\n]/g, ' ');
  const priorityStr = (task.priority || 'medium').toUpperCase();
  const desc = (task.description || '').replace(/\r?\n/g, '\\n');

  let remMs = task.reminderTime;
  if (!remMs) {
    if (task.reminderMode === 'preset') {
      const m = parseInt(task.reminderPresetMinutes, 10) || 15;
      remMs = start.getTime() - m * 60000;
    } else if (task.reminderMode === 'exact' && task.reminderExact) {
      remMs = new Date(task.reminderExact).getTime();
    } else {
      remMs = start.getTime() - 15 * 60000;
    }
  }
  const remStart = new Date(remMs);
  const remEnd = new Date(remStart.getTime() + 15 * 60 * 1000);

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TaskFlow Pro//Dual-Event Calendar Engine//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',

    // --- EVENT 1: Scheduled Reminder Alert ---
    'BEGIN:VEVENT',
    `UID:taskflow_${taskId}_reminder@taskflow.pro`,
    `DTSTAMP:${formatICS(now)}`,
    `DTSTART:${formatICS(remStart)}`,
    `DTEND:${formatICS(remEnd)}`,
    `SUMMARY:⏰ Reminder Alert: ${cleanTitle}`,
    `DESCRIPTION:Reminder for upcoming task "${cleanTitle}"\\nTarget Deadline: ${start.toLocaleString()}\\nPriority: ${priorityStr}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT0M',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${cleanTitle}`,
    'END:VALARM',
    'END:VEVENT',

    // --- EVENT 2: Actual Task Deadline Milestone ---
    'BEGIN:VEVENT',
    `UID:taskflow_${taskId}_deadline@taskflow.pro`,
    `DTSTAMP:${formatICS(now)}`,
    `DTSTART:${formatICS(start)}`,
    `DTEND:${formatICS(end)}`,
    `SUMMARY:🎯 Deadline: ${cleanTitle}`,
    `DESCRIPTION:Final Deadline for "${cleanTitle}"\\nPriority: ${priorityStr}\\n\\n${desc}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT10M',
    'ACTION:DISPLAY',
    `DESCRIPTION:Deadline in 10 minutes: ${cleanTitle}`,
    'END:VALARM',
    'END:VEVENT',

    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${cleanTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_events.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
