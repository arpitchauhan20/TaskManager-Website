import React, { useState, useEffect, useRef } from 'react';

export default function TaskRow({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
  onSyncGoogleCalendar,
  onDownloadICS,
  onSendEmail
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);
  const isOverdue = () => {
    if (task.completed || !task.deadline) return false;
    return new Date(task.deadline).getTime() < Date.now();
  };

  const overdue = isOverdue();
  const diffHours = (new Date(task.deadline).getTime() - Date.now()) / 3600000;
  const isUrgent = !task.completed && diffHours > 0 && diffHours <= 24;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const now = Date.now();
    const target = new Date(dateStr).getTime();
    const diffMs = target - now;
    const isPast = diffMs < 0;
    const absDiff = Math.abs(diffMs);

    const min = Math.round(absDiff / 60000);
    const hrs = Math.round(absDiff / 3600000);
    const days = Math.round(absDiff / 86400000);

    if (min < 1) return isPast ? 'Just now' : 'Due in seconds';
    if (min < 60) return isPast ? `${min}m overdue` : `Due in ${min}m`;
    if (hrs < 24) return isPast ? `${hrs}h overdue` : `Due in ${hrs}h`;
    return isPast ? `${days}d overdue` : `Due in ${days}d`;
  };

  const formatReminderDesc = () => {
    if (!task.reminderMode || task.reminderMode === 'none') return null;
    if (task.reminderMode === 'preset') {
      const m = task.reminderPresetMinutes || 15;
      return m < 60 ? `${m}m before` : m === 60 ? '1 hour before' : '1 day before';
    }
    if (task.reminderMode === 'offset') {
      return `${task.reminderOffsetValue || 1} ${task.reminderOffsetUnit || 'hours'} before`;
    }
    if (task.reminderMode === 'exact' && task.reminderExact) {
      const d = new Date(task.reminderExact);
      return `At ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return 'Active';
  };

  const reminderDesc = formatReminderDesc();
  const channels = task.channels || { push: true, sound: true, calendar: false, whatsapp: false, email: false };

  return (
    <div
      className={`task-card priority-${task.priority || 'medium'} ${task.completed ? 'completed' : ''} ${overdue ? 'overdue-card' : ''}`}
      data-id={task.id}
    >
      {/* Col 1: Status Checkbox */}
      <div
        className={`task-checkbox ${task.completed ? 'checked' : ''}`}
        onClick={() => onToggleComplete(task.id)}
        title={task.completed ? 'Mark pending' : 'Mark complete'}
      />

      {/* Col 2: Task Details */}
      <div className="task-content">
        <div
          className="task-title"
          onClick={() => onEdit(task.id)}
          style={{ cursor: 'pointer' }}
          title="Click to edit task"
        >
          {task.title}
        </div>
        {task.description && (
          <div className="task-description">{task.description}</div>
        )}
      </div>

      {/* Col 3: Deadline & Urgency */}
      <div className="task-col-deadline">
        <span className="tag-deadline-date">
          📅 {formatDate(task.deadline)} {formatTime(task.deadline)}
        </span>
        <span className={`tag-deadline-rel ${overdue ? 'overdue' : isUrgent ? 'urgent' : ''}`}>
          {overdue ? '⚠️ ' : isUrgent ? '⏳ ' : '⌛ '}
          {getRelativeTime(task.deadline)}
        </span>
      </div>

      {/* Col 4: Priority */}
      <div className="task-col-priority">
        <span className={`tag-prio-pill ${task.priority || 'medium'}`}>
          {(task.priority || 'medium').toUpperCase()}
        </span>
      </div>

      {/* Col 5: Reminder & Channels */}
      <div className="task-col-reminder">
        {reminderDesc ? (
          <span className="tag-reminder-chip" title={`Reminder scheduled: ${reminderDesc}`}>
            ⏰ {reminderDesc}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>No alert</span>
        )}

        <div className="task-channels-pill-row">
          {channels.push && <span className="chan-badge push" title="Browser & Mobile Push">🔔 Push</span>}
          {channels.sound && <span className="chan-badge sound" title="5.5s Audio Bell Chime">🔊 Bell</span>}
          {channels.calendar && <span className="chan-badge cal" title="Calendar Sync Enabled">📅 Cal</span>}
          {channels.email && <span className="chan-badge mail" title="Automated Resend Email">📧 Mail</span>}
        </div>
      </div>

      {/* Col 6: Actions */}
      <div className="task-actions">
        {/* 1-Click Google Calendar Sync Pill */}
        <button
          type="button"
          className="action-pill-cal"
          onClick={() => onSyncGoogleCalendar(task)}
          title="1-Click Sync to Google Calendar"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span style={{ color: '#ffffff', fontWeight: 600 }}>Sync</span>
        </button>

        {/* Edit Button */}
        <button
          type="button"
          className="action-icon-btn"
          onClick={() => onEdit(task.id)}
          title="Edit Task"
        >
          ✏️
        </button>

        {/* More Actions Toggle */}
        <button
          type="button"
          className="action-icon-btn"
          onClick={() => setMenuOpen(prev => !prev)}
          title="More options (Email, Calendar .ics)"
        >
          •••
        </button>

        {/* Delete Button */}
        <button
          type="button"
          className="action-icon-btn delete"
          onClick={() => onDelete(task.id)}
          title="Delete Task"
        >
          🗑️
        </button>

        {/* Floating More Options Dropdown */}
        {menuOpen && (
          <div className="action-menu-dropdown" ref={menuRef} onClick={e => e.stopPropagation()}>

            <button
              type="button"
              className="action-menu-item mail"
              onClick={() => {
                setMenuOpen(false);
                onSendEmail(task);
              }}
            >
              <span>📧</span>
              <span>Send Email via Resend</span>
            </button>

            <button
              type="button"
              className="action-menu-item"
              onClick={() => {
                setMenuOpen(false);
                onDownloadICS(task);
              }}
            >
              <span>📥</span>
              <span>Download .ics File</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
