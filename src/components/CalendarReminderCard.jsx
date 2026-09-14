import React, { useState, useMemo } from 'react';
import { createCalendarReminder } from '../services/calendarService';
import {
  CalendarIcon,
  GlobeIcon,
  CheckCircleIcon,
  PlusIcon,
  CheckIcon,
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  LinkIcon,
  ZapIcon
} from './Icons';

export default function CalendarReminderCard({
  isCalendarConnected,
  isCalendarLoading,
  currentUser,
  onConnectCalendar,
  onDisconnectCalendar,
  onOpenAuthModal,
  onShowToast,
  onBack,
  tasks = []
}) {
  // Calendar View State (Month/Year)
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(selectedDate);
  const [time, setTime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  });
  const [reminderMinutes, setReminderMinutes] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentEvents, setRecentEvents] = useState([]);
  const [lastCreatedEvent, setLastCreatedEvent] = useState(null);

  // Detect local IANA timezone
  const localTimeZone = typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'UTC';

  // Handle Month Navigation
  const handlePrevMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleJumpToday = () => {
    const today = new Date();
    setViewDate(today);
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    setSelectedDate(todayStr);
    setDate(todayStr);
  };

  const handleSelectDay = (dayStr) => {
    setSelectedDate(dayStr);
    setDate(dayStr);
  };

  // Build Calendar Matrix for viewDate
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const pDay = daysInPrevMonth - i;
      const pMonth = month === 0 ? 12 : month;
      const pYear = month === 0 ? year - 1 : year;
      const dateStr = `${pYear}-${String(pMonth).padStart(2, '0')}-${String(pDay).padStart(2, '0')}`;
      days.push({ dayNumber: pDay, dateStr, isCurrentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dayNumber: d, dateStr, isCurrentMonth: true });
    }

    // Next month padding to fill 35 or 42 grid cells
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let n = 1; n <= remaining; n++) {
      const nMonth = month + 2 > 12 ? 1 : month + 2;
      const nYear = month + 2 > 12 ? year + 1 : year;
      const dateStr = `${nYear}-${String(nMonth).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
      days.push({ dayNumber: n, dateStr, isCurrentMonth: false });
    }

    return days;
  }, [viewDate]);

  // Map dates to tasks/reminders count
  const taskDatesMap = useMemo(() => {
    const map = {};
    tasks.forEach(t => {
      if (t.deadline) {
        const dStr = t.deadline.slice(0, 10);
        map[dStr] = (map[dStr] || 0) + 1;
      }
    });
    return map;
  }, [tasks]);

  // All scheduled reminders / events for history
  const allScheduledEvents = useMemo(() => {
    const list = [...recentEvents];
    tasks.forEach(t => {
      if (t.deadline) {
        list.push({
          id: t.id,
          title: t.title,
          description: t.description,
          startTime: t.deadline,
          source: 'task',
          priority: t.priority,
          completed: t.completed
        });
      }
    });
    return list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [recentEvents, tasks]);

  // Events for the selected date
  const selectedDateEvents = useMemo(() => {
    return allScheduledEvents.filter(e => {
      if (!e.startTime) return false;
      return e.startTime.startsWith(selectedDate);
    });
  }, [allScheduledEvents, selectedDate]);

  const handleConnectClick = (e) => {
    if (e) e.stopPropagation();
    if (!currentUser) {
      if (onOpenAuthModal) onOpenAuthModal('login');
      if (onShowToast) onShowToast('info', 'lock', 'Please sign in first to connect Google Calendar.');
      return;
    }
    if (onConnectCalendar) {
      onConnectCalendar();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      if (onShowToast) onShowToast('error', 'alert', 'Please enter a reminder title.');
      return;
    }

    if (!date || !time) {
      if (onShowToast) onShowToast('error', 'alert', 'Please select both date and time.');
      return;
    }

    const startDateTime = new Date(`${date}T${time}:00`);
    if (isNaN(startDateTime.getTime())) {
      if (onShowToast) onShowToast('error', 'alert', 'Invalid date or time specified.');
      return;
    }

    const endDateTime = new Date(startDateTime.getTime() + 30 * 60 * 1000);
    setIsSubmitting(true);

    try {
      const res = await createCalendarReminder({
        title: title.trim(),
        description: description.trim(),
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        reminderMinutes: parseInt(reminderMinutes, 10),
        timeZone: localTimeZone
      });

      if (res.success && res.event) {
        const newEv = {
          id: res.event.id || 'ev_' + Date.now(),
          title: title.trim(),
          description: description.trim(),
          startTime: startDateTime.toISOString(),
          htmlLink: res.event.htmlLink,
          source: 'gcal_reminder'
        };
        setRecentEvents(prev => [newEv, ...prev]);
        setLastCreatedEvent(res.event);
        setTitle('');
        setDescription('');
        if (onShowToast) {
          onShowToast('success', 'calendar', 'Added to Google Calendar');
        }
      } else {
        throw new Error(res.error || 'Could not create reminder');
      }
    } catch (err) {
      if (onShowToast) {
        onShowToast('error', 'alert', err.message || 'Failed to create reminder in Google Calendar.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const todayStr = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }, []);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="calendar-board-wrapper tab-view-animated">
      {/* Top Status Context Bar (Compact, No Duplicate Back Button Strip) */}
      <div className="calendar-status-bar">
        <div className="cal-status-left">
          <span className="cal-section-tagline">Visual scheduling, 1-click Google sync &amp; reminder history</span>
        </div>
        <div className="cal-status-right">
          <span className={`badge-status-pill ${isCalendarConnected ? 'active' : ''}`}>
            {isCalendarConnected ? '✓ Google Synced' : 'Offline'}
          </span>
          <span className="badge-tz-pill">
            <GlobeIcon size={12} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
            {localTimeZone}
          </span>
        </div>
      </div>

      {/* Main Two-Column Grid: Left Visual Calendar, Right Add Reminder Form */}
      <div className="calendar-suite-grid">
        {/* Left Column: Interactive Visual Calendar Widget */}
        <div className="calendar-widget-panel">
          <div className="calendar-widget-header">
            <div className="month-selector">
              <span className="month-name">
                {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
              </span>
            </div>
            <div className="calendar-widget-nav">
              <button
                type="button"
                className="cal-nav-btn"
                onClick={handlePrevMonth}
                title="Previous Month"
              >
                <ChevronLeftIcon size={15} />
              </button>
              <button
                type="button"
                className="cal-today-btn"
                onClick={handleJumpToday}
                title="Jump to Today"
              >
                Today
              </button>
              <button
                type="button"
                className="cal-nav-btn"
                onClick={handleNextMonth}
                title="Next Month"
              >
                <ChevronRightIcon size={15} />
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="calendar-weekdays-row">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
              <span key={day} className="weekday-label">{day}</span>
            ))}
          </div>

          {/* Day Cells Matrix */}
          <div className="calendar-matrix-grid">
            {calendarDays.map((item, idx) => {
              const isToday = item.dateStr === todayStr;
              const isSelected = item.dateStr === selectedDate;
              const hasEvents = Boolean(taskDatesMap[item.dateStr]);

              return (
                <button
                  key={idx}
                  type="button"
                  className={`cal-day-cell ${!item.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectDay(item.dateStr)}
                  title={item.dateStr}
                >
                  <span className="day-number">{item.dayNumber}</span>
                  {hasEvents && <span className="day-event-dot" />}
                </button>
              );
            })}
          </div>

          {/* Selected Date Summary Strip */}
          <div className="selected-date-strip">
            <div className="selected-date-info">
              <strong className="selected-date-title">
                {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </strong>
              <span className="selected-date-count">
                {selectedDateEvents.length} event{selectedDateEvents.length === 1 ? '' : 's'} scheduled
              </span>
            </div>
            {selectedDateEvents.length > 0 && (
              <div className="selected-date-events-preview">
                {selectedDateEvents.slice(0, 3).map((ev, i) => (
                  <div key={i} className="mini-event-chip">
                    <span className="event-chip-time">{ev.startTime ? ev.startTime.slice(11, 16) : ''}</span>
                    <span className="event-chip-title">{ev.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Add New Reminder Form */}
        <div className="calendar-form-panel">
          <div className="form-panel-header">
            <div className="form-panel-title-wrap">
              <PlusIcon size={16} style={{ color: 'var(--accent, #6366f1)' }} />
              <h3 className="form-panel-title">Add New Reminder &amp; Schedule</h3>
            </div>
            {onDisconnectCalendar && isCalendarConnected && (
              <button
                type="button"
                className="btn-disconnect-subtle"
                onClick={onDisconnectCalendar}
                disabled={isCalendarLoading}
              >
                Disconnect
              </button>
            )}
          </div>

          {!isCalendarConnected ? (
            <div className="reminder-disconnected-box" style={{ padding: '24px 16px', margin: '10px 0' }}>
              <div className="disconnected-icon-wrap">
                <CalendarIcon size={26} />
              </div>
              <div>
                <h4 className="disconnected-card-heading">Connect Google Calendar</h4>
                <p className="reminder-disconnected-text" style={{ fontSize: '12px' }}>
                  Link your account to auto-sync scheduled reminders directly to Google Calendar.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-connect-google"
                onClick={handleConnectClick}
                disabled={isCalendarLoading}
              >
                {isCalendarLoading ? 'Connecting...' : 'Connect Google Calendar'}
              </button>
            </div>
          ) : null}

          {lastCreatedEvent && (
            <div className="reminder-success-box" style={{ padding: '12px 16px', marginBottom: '12px' }}>
              <div className="success-banner" style={{ fontSize: '13px' }}>
                <CheckCircleIcon size={16} className="success-icon" style={{ color: '#10b981' }} />
                <span className="success-message">Event successfully synced with Google Calendar!</span>
              </div>
              {lastCreatedEvent.htmlLink && (
                <a
                  href={lastCreatedEvent.htmlLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-open-gcal btn-sm"
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  <span>Open in Google Calendar ↗</span>
                </a>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="reminder-form">
            <div className="reminder-form-grid" style={{ gap: '12px' }}>
              {/* Title */}
              <div className="form-group title-group">
                <label htmlFor="reminder-title">Reminder Title</label>
                <input
                  id="reminder-title"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Executive Sync & Project Review"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              {/* Description */}
              <div className="form-group desc-group">
                <label htmlFor="reminder-desc">Notes / Agenda (Optional)</label>
                <input
                  id="reminder-desc"
                  type="text"
                  className="form-input"
                  placeholder="Brief agenda notes or meeting link"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Date */}
              <div className="form-group date-group">
                <label htmlFor="reminder-date">Date</label>
                <input
                  id="reminder-date"
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setSelectedDate(e.target.value);
                  }}
                  required
                />
              </div>

              {/* Time */}
              <div className="form-group time-group">
                <label htmlFor="reminder-time">Time</label>
                <input
                  id="reminder-time"
                  type="time"
                  className="form-input"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>

              {/* Remind Me Override */}
              <div className="form-group remind-group">
                <label htmlFor="reminder-minutes">Alarm Notice</label>
                <select
                  id="reminder-minutes"
                  className="form-input form-select"
                  value={reminderMinutes}
                  onChange={(e) => setReminderMinutes(Number(e.target.value))}
                >
                  <option value={0}>At time of event</option>
                  <option value={5}>5 minutes before</option>
                  <option value={10}>10 minutes before</option>
                  <option value={15}>15 minutes before</option>
                  <option value={30}>30 minutes before</option>
                  <option value={60}>1 hour before</option>
                  <option value={1440}>1 day before</option>
                </select>
              </div>
            </div>

            <div className="reminder-form-footer" style={{ marginTop: '16px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <ZapIcon size={14} style={{ marginRight: '6px' }} />
                <span>{isSubmitting ? 'Syncing with Google...' : 'Add to Google Calendar'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Bottom Section: Total Reminders & History */}
      <div className="calendar-history-section">
        <div className="history-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClockIcon size={16} style={{ color: 'var(--accent-light, #818cf8)' }} />
            <h3 className="history-title">Total Reminders &amp; Scheduled History</h3>
          </div>
          <span className="badge-count-pill">
            {allScheduledEvents.length} Total Scheduled
          </span>
        </div>

        {allScheduledEvents.length === 0 ? (
          <div className="history-empty-state">
            <p>No reminders or deadlines scheduled yet. Use the form above or pick a date on the calendar to schedule one!</p>
          </div>
        ) : (
          <div className="history-events-grid">
            {allScheduledEvents.map((ev, i) => {
              const d = ev.startTime ? new Date(ev.startTime) : null;
              const dateStr = d && !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Flexible';
              const timeStr = d && !isNaN(d.getTime()) ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';

              return (
                <div key={ev.id || i} className="history-event-card">
                  <div className="history-card-lead">
                    <span className="history-card-bullet" />
                    <div className="history-card-info">
                      <h4 className="history-event-title">{ev.title}</h4>
                      {ev.description && <p className="history-event-desc">{ev.description}</p>}
                    </div>
                  </div>

                  <div className="history-card-meta">
                    <span className="history-date-badge">
                      📅 {dateStr} {timeStr && `• ${timeStr}`}
                    </span>
                    {ev.htmlLink ? (
                      <a
                        href={ev.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-gcal-link"
                        title="Open in Google Calendar"
                      >
                        <LinkIcon size={12} style={{ marginRight: '3px' }} />
                        <span>Google Cal ↗</span>
                      </a>
                    ) : (
                      <span className="badge-status-pill active" style={{ fontSize: '10px', padding: '2px 6px' }}>
                        Active
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
