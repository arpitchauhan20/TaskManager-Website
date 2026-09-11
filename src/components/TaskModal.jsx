import React, { useState, useEffect } from 'react';
import { SoundFX } from '../services/soundEngine';

export default function TaskModal({
  isOpen,
  onClose,
  onSave,
  taskToEdit,
  defaultWhatsApp,
  defaultEmail,
  soundEnabled
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState('medium');

  // Reminder State
  const [reminderMode, setReminderMode] = useState('preset'); // 'none' | 'preset' | 'offset' | 'exact'
  const [reminderPresetMinutes, setReminderPresetMinutes] = useState(15);
  const [reminderOffsetValue, setReminderOffsetValue] = useState(2);
  const [reminderOffsetUnit, setReminderOffsetUnit] = useState('hours');
  const [reminderExact, setReminderExact] = useState('');

  // Channels State
  const [channels, setChannels] = useState({
    push: true,
    sound: true,
    calendar: true,
    email: true
  });

  const [reminderEmail, setReminderEmail] = useState('');

  // Populate form on open or taskToEdit change
  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title || '');
      setDescription(taskToEdit.description || '');
      setDeadline(taskToEdit.deadline || '');
      setPriority(taskToEdit.priority || 'medium');
      setReminderMode(taskToEdit.reminderMode || 'preset');
      setReminderPresetMinutes(taskToEdit.reminderPresetMinutes || 15);
      setReminderOffsetValue(taskToEdit.reminderOffsetValue || 2);
      setReminderOffsetUnit(taskToEdit.reminderOffsetUnit || 'hours');
      setReminderExact(taskToEdit.reminderExact || '');
      setChannels(taskToEdit.channels || { push: true, sound: true, calendar: true, email: true });
      setReminderEmail(taskToEdit.reminderEmail || defaultEmail || '');
    } else {
      // Default new task
      const def = new Date();
      def.setDate(def.getDate() + 1);
      def.setHours(17, 0, 0, 0);
      const defLocal = new Date(def.getTime() - def.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

      setTitle('');
      setDescription('');
      setDeadline(defLocal);
      setPriority('medium');
      setReminderMode('preset');
      setReminderPresetMinutes(15);
      setReminderOffsetValue(2);
      setReminderOffsetUnit('hours');
      setReminderExact('');
      setChannels({ push: true, sound: true, calendar: true, email: true });
      setReminderEmail(defaultEmail || '');
    }
  }, [taskToEdit, isOpen, defaultEmail]);

  if (!isOpen) return null;

  const toggleChannel = (key) => {
    setChannels(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getCalculatedReminderTime = () => {
    if (reminderMode === 'none') return null;
    if (reminderMode === 'exact') return reminderExact ? new Date(reminderExact).getTime() : null;
    if (!deadline) return null;

    const deadTime = new Date(deadline).getTime();
    if (isNaN(deadTime)) return null;

    if (reminderMode === 'preset') {
      return deadTime - reminderPresetMinutes * 60000;
    }
    if (reminderMode === 'offset') {
      const multipliers = { minutes: 60000, hours: 3600000, days: 86400000 };
      const ms = (reminderOffsetValue || 1) * (multipliers[reminderOffsetUnit] || 3600000);
      return deadTime - ms;
    }
    return null;
  };

  const reminderCalculatedMs = getCalculatedReminderTime();
  const formatReminderPreview = () => {
    if (!reminderCalculatedMs) return null;
    const now = Date.now();
    const isPast = reminderCalculatedMs < now;
    const d = new Date(reminderCalculatedMs);
    const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return {
      formatted: `${dateStr} at ${timeStr}`,
      isPast
    };
  };

  const preview = formatReminderPreview();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !deadline) return;

    onSave({
      title: title.trim(),
      description: description.trim(),
      deadline,
      priority,
      reminderMode,
      reminderPresetMinutes,
      reminderOffsetValue,
      reminderOffsetUnit,
      reminderExact,
      channels,
      reminderEmail: (channels.email || channels.calendar) ? reminderEmail.trim() : null
    });
  };

  const selectPreset = (minutes) => {
    setReminderMode('preset');
    setReminderPresetMinutes(minutes);
  };

  return (
    <div className="modal-overlay active" id="task-modal" onClick={e => e.target.id === 'task-modal' && onClose()}>
      <div className="modal modal-task">
        {/* Fixed Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{taskToEdit ? 'Edit Task' : 'Create New Task'}</h2>
            <p className="modal-subtitle">Define deadline, priority, and smart reminder alerts</p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="Close" aria-label="Close">
            ✕
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="modal-form-wrapper">
          <div className="modal-body">
            {/* Task Title */}
            <div className="form-group">
              <label className="form-label" htmlFor="modal-title-input">
                Task Title <span className="required-star">*</span>
              </label>
              <input
                id="modal-title-input"
                className="form-input"
                type="text"
                placeholder="e.g. Quarterly Board Presentation"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                autoFocus
              />
            </div>

            {/* Deadline & Priority Grid */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="modal-deadline-input">
                  Deadline &amp; Time <span className="required-star">*</span>
                </label>
                <input
                  id="modal-deadline-input"
                  className="form-input"
                  type="datetime-local"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="modal-priority-input">
                  Priority
                </label>
                <select
                  id="modal-priority-input"
                  className="form-input form-select"
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                >
                  <option value="high">🔥 High Priority</option>
                  <option value="medium">⚡ Medium Priority</option>
                  <option value="low">🌱 Low Priority</option>
                </select>
              </div>
            </div>

            {/* Description (Optional) */}
            <div className="form-group">
              <label className="form-label" htmlFor="modal-desc-input">
                Description / Notes <span className="optional-badge">Optional</span>
              </label>
              <textarea
                id="modal-desc-input"
                className="form-input form-textarea"
                rows="2"
                placeholder="Add key deliverables, agenda, or reference links..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            {/* Reminder & Alarms Card */}
            <div className="reminder-card">
              <div className="reminder-header-row">
                <div className="reminder-header-title">
                  <span className="reminder-header-icon">⏰</span>
                  <div>
                    <strong>Reminder &amp; Alerts</strong>
                    <div className="reminder-subtitle">Customize trigger timing and delivery channels</div>
                  </div>
                </div>

                <div className="reminder-status-pill">
                  {reminderMode === 'none' ? 'Alerts Disabled' : 'Alerts Active'}
                </div>
              </div>

              {/* Clean Unified Timing Pills */}
              <div className="reminder-mode-pills">
                <button
                  type="button"
                  className={`reminder-pill-btn ${reminderMode === 'preset' && reminderPresetMinutes === 15 ? 'active' : ''}`}
                  onClick={() => selectPreset(15)}
                >
                  15m before
                </button>
                <button
                  type="button"
                  className={`reminder-pill-btn ${reminderMode === 'preset' && reminderPresetMinutes === 30 ? 'active' : ''}`}
                  onClick={() => selectPreset(30)}
                >
                  30m before
                </button>
                <button
                  type="button"
                  className={`reminder-pill-btn ${reminderMode === 'preset' && reminderPresetMinutes === 60 ? 'active' : ''}`}
                  onClick={() => selectPreset(60)}
                >
                  1h before
                </button>
                <button
                  type="button"
                  className={`reminder-pill-btn ${reminderMode === 'preset' && reminderPresetMinutes === 1440 ? 'active' : ''}`}
                  onClick={() => selectPreset(1440)}
                >
                  1 day before
                </button>
                <button
                  type="button"
                  className={`reminder-pill-btn ${reminderMode === 'offset' ? 'active' : ''}`}
                  onClick={() => setReminderMode('offset')}
                >
                  Custom
                </button>
                <button
                  type="button"
                  className={`reminder-pill-btn ${reminderMode === 'exact' ? 'active' : ''}`}
                  onClick={() => setReminderMode('exact')}
                >
                  Exact Time
                </button>
                <button
                  type="button"
                  className={`reminder-pill-btn ${reminderMode === 'none' ? 'active' : ''}`}
                  onClick={() => setReminderMode('none')}
                >
                  No Alert
                </button>
              </div>

              {/* Custom Offset Row */}
              {reminderMode === 'offset' && (
                <div className="custom-offset-row" style={{ marginBottom: '12px' }}>
                  <input
                    className="form-input offset-value-input"
                    type="number"
                    min="1"
                    max="365"
                    style={{ width: '80px' }}
                    value={reminderOffsetValue}
                    onChange={e => setReminderOffsetValue(parseFloat(e.target.value) || 1)}
                  />
                  <select
                    className="form-input form-select offset-unit-select"
                    value={reminderOffsetUnit}
                    onChange={e => setReminderOffsetUnit(e.target.value)}
                  >
                    <option value="minutes">Minutes before deadline</option>
                    <option value="hours">Hours before deadline</option>
                    <option value="days">Days before deadline</option>
                  </select>
                </div>
              )}

              {/* Exact Time Input */}
              {reminderMode === 'exact' && (
                <div style={{ marginBottom: '12px' }}>
                  <input
                    className="form-input"
                    type="datetime-local"
                    value={reminderExact}
                    onChange={e => setReminderExact(e.target.value)}
                  />
                </div>
              )}

              {/* Scheduled Trigger Banner */}
              {reminderMode !== 'none' && preview && (
                <div className="reminder-preview-chip">
                  <span className="reminder-preview-icon">{preview.isPast ? '⚠️' : '🔔'}</span>
                  <span>
                    {preview.isPast ? 'Selected time is in the past: ' : 'Alert triggers on: '}
                    <strong>{preview.formatted}</strong>
                  </span>
                </div>
              )}

              {/* Delivery Channels */}
              {reminderMode !== 'none' && (
                <div className="channels-section">
                  <div className="channels-section-title">Delivery Channels</div>
                  <div className="channels-grid">
                    {/* Push */}
                    <div
                      className={`channel-choice ${channels.push ? 'active' : ''}`}
                      onClick={() => toggleChannel('push')}
                    >
                      <span className="channel-choice-icon">🔔</span>
                      <div className="channel-choice-info">
                        <span className="channel-choice-name">Browser Push</span>
                        <span className="channel-choice-desc">Desktop &amp; mobile alerts</span>
                      </div>
                      <span className="channel-check-mark">{channels.push ? '✓' : ''}</span>
                    </div>

                    {/* Sound */}
                    <div
                      className={`channel-choice ${channels.sound ? 'active' : ''}`}
                      onClick={() => toggleChannel('sound')}
                    >
                      <span className="channel-choice-icon">🔊</span>
                      <div className="channel-choice-info">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                          <span className="channel-choice-name">Audio Bell</span>
                          <button
                            type="button"
                            className="btn-sound-preview"
                            onClick={(e) => {
                              e.stopPropagation();
                              SoundFX.playReminderChime(soundEnabled);
                            }}
                            title="Test reminder chime"
                          >
                            ▶ Test
                          </button>
                        </div>
                        <span className="channel-choice-desc">Harmonic alert chime</span>
                      </div>
                      <span className="channel-check-mark">{channels.sound ? '✓' : ''}</span>
                    </div>

                    {/* Google Calendar */}
                    <div
                      className={`channel-choice ${channels.calendar ? 'active' : ''}`}
                      onClick={() => toggleChannel('calendar')}
                    >
                      <span className="channel-choice-icon">📅</span>
                      <div className="channel-choice-info">
                        <span className="channel-choice-name">Google Calendar</span>
                        <span className="channel-choice-desc">Sync event (.ics invite)</span>
                      </div>
                      <span className="channel-check-mark">{channels.calendar ? '✓' : ''}</span>
                    </div>

                    {/* Email */}
                    <div
                      className={`channel-choice ${channels.email ? 'active' : ''}`}
                      onClick={() => toggleChannel('email')}
                    >
                      <span className="channel-choice-icon">📧</span>
                      <div className="channel-choice-info">
                        <span className="channel-choice-name">Email Alert</span>
                        <span className="channel-choice-desc">Automated email delivery</span>
                      </div>
                      <span className="channel-check-mark">{channels.email ? '✓' : ''}</span>
                    </div>
                  </div>

                  {/* Destination Contact Email */}
                  {(channels.calendar || channels.email) && (
                    <div className="channel-email-box">
                      <label className="channel-email-label" htmlFor="modal-reminder-email">
                        Deliver Calendar &amp; Email To:
                      </label>
                      <div className="input-with-icon">
                        <span className="input-icon">✉️</span>
                        <input
                          id="modal-reminder-email"
                          className="form-input"
                          type="email"
                          placeholder="e.g. yourname@gmail.com"
                          value={reminderEmail}
                          onChange={e => setReminderEmail(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" id="save-task-btn">
              <span>{taskToEdit ? 'Update Task' : 'Save Task'}</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
