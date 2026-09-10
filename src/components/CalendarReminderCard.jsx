import React, { useState } from 'react';
import { createCalendarReminder } from '../services/calendarService';

export default function CalendarReminderCard({
  isCalendarConnected,
  isCalendarLoading,
  currentUser,
  onConnectCalendar,
  onOpenAuthModal,
  onShowToast
}) {
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Default date to today
  const [date, setDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Default time to next full hour
  const [time, setTime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  });

  const [reminderMinutes, setReminderMinutes] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastCreatedEvent, setLastCreatedEvent] = useState(null);

  // Detect local IANA timezone
  const localTimeZone = typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'UTC';

  const handleConnectClick = () => {
    if (!currentUser) {
      if (onOpenAuthModal) onOpenAuthModal('login');
      if (onShowToast) onShowToast('info', '🔒', 'Please sign in first to connect Google Calendar.');
      return;
    }
    if (onConnectCalendar) {
      onConnectCalendar();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      if (onShowToast) onShowToast('error', '⚠️', 'Please enter a reminder title.');
      return;
    }

    if (!date || !time) {
      if (onShowToast) onShowToast('error', '⚠️', 'Please select both date and time.');
      return;
    }

    // Combine date and time in local timezone to produce ISO string
    const startDateTime = new Date(`${date}T${time}:00`);
    if (isNaN(startDateTime.getTime())) {
      if (onShowToast) onShowToast('error', '⚠️', 'Invalid date or time specified.');
      return;
    }

    // Default duration 30 minutes
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
        setLastCreatedEvent(res.event);
        if (onShowToast) {
          onShowToast('success', '📅', '✓ Reminder added to Google Calendar!');
        }
      } else {
        throw new Error(res.error || 'Could not create reminder');
      }
    } catch (err) {
      if (onShowToast) {
        onShowToast('error', '❌', err.message || 'Failed to create reminder in Google Calendar.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setLastCreatedEvent(null);
    setTitle('');
    setDescription('');
  };

  return (
    <div className="calendar-reminder-card">
      <div className="reminder-card-header">
        <div className="reminder-header-title">
          <span className="reminder-header-icon">⏰</span>
          <div>
            <h3 className="reminder-title">Calendar Reminder</h3>
            <span className="reminder-subtitle">Instant Google Calendar event with popup notification</span>
          </div>
        </div>
        <div className="reminder-tz-badge" title="Detected IANA Timezone">
          🌐 {localTimeZone}
        </div>
      </div>

      {!isCalendarConnected ? (
        <div className="reminder-disconnected-box">
          <p className="reminder-disconnected-text">Google Calendar isn't connected.</p>
          <button
            type="button"
            className="btn btn-connect-google"
            onClick={handleConnectClick}
            disabled={isCalendarLoading}
          >
            {isCalendarLoading ? 'Connecting...' : 'Connect Google Calendar'}
          </button>
        </div>
      ) : lastCreatedEvent ? (
        <div className="reminder-success-box">
          <div className="success-banner">
            <span className="success-icon">✓</span>
            <span className="success-message">Reminder added to Google Calendar</span>
          </div>

          <div className="success-actions">
            {lastCreatedEvent.htmlLink && (
              <a
                href={lastCreatedEvent.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-open-gcal"
              >
                <span>Open in Google Calendar ↗</span>
              </a>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleResetForm}
            >
              + Create Another Reminder
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="reminder-form">
          <div className="reminder-form-grid">
            {/* Title */}
            <div className="form-group title-group">
              <label htmlFor="reminder-title">Title</label>
              <input
                id="reminder-title"
                type="text"
                className="form-input"
                placeholder="Team Meeting"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="form-group desc-group">
              <label htmlFor="reminder-desc">Description</label>
              <input
                id="reminder-desc"
                type="text"
                className="form-input"
                placeholder="Weekly team meeting"
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
                onChange={(e) => setDate(e.target.value)}
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
              <label htmlFor="reminder-minutes">Remind me</label>
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

          <div className="reminder-form-footer">
            <button
              type="submit"
              className="btn btn-add-reminder"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating Event...' : 'Add to Google Calendar'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
