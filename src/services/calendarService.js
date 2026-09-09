// ==========================================
// Google Calendar & iCalendar (.ics) Service
// ==========================================

export function formatGCalDate(date) {
  const d = new Date(date);
  return d.toISOString().replace(/-|:|\.\d\d\d/g, '');
}

export function openGoogleCalendar(task) {
  const deadline = task.deadline ? new Date(task.deadline) : new Date(Date.now() + 3600000);
  const end = new Date(deadline.getTime() + 30 * 60 * 1000); // 30 min duration for deadline event

  // Calculate reminder date and time
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
