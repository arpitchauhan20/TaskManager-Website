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
    whatsapp: true,
    email: true
  });

  const [whatsappNumber, setWhatsappNumber] = useState('');
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
      setChannels(taskToEdit.channels || { push: true, sound: true, calendar: true, whatsapp: true, email: true });
      setWhatsappNumber(taskToEdit.whatsappNumber || defaultWhatsApp || '');
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
      setChannels({ push: true, sound: true, calendar: true, whatsapp: true, email: true });
      setWhatsappNumber(defaultWhatsApp || '');
      setReminderEmail(defaultEmail || '');
    }
  }, [taskToEdit, isOpen, defaultWhatsApp, defaultEmail]);

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
      whatsappNumber: channels.whatsapp ? whatsappNumber.trim() : null,
      reminderEmail: channels.email ? reminderEmail.trim() : null
    });
  };

  return (
    <div className="modal-overlay active" id="task-modal" onClick={e => e.target.id === 'task-modal' && onClose()}>
      <div className="modal">
        <div className="modal-handle" />

        <div className="modal-header">
          <div>
            <h2 className="modal-title">{taskToEdit ? 'Edit Task' : 'Create New Task'}</h2>
            <p className="modal-subtitle">Define deadline and configure customizable reminder alerts</p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
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

          {/* Description */}
          <div className="form-group">
            <label className="form-label" htmlFor="modal-desc-input">
              Description / Notes (Optional)
            </label>
            <textarea
              id="modal-desc-input"
              className="form-input form-textarea"
              rows="2"
              placeholder="Add key objectives, links, or deliverables..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Deadline & Priority */}
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

          {/* Reminder Alert Section */}
          <div className="reminder-card">
            <div className="reminder-header-title">
              <span style={{ fontSize: '20px' }}>⏰</span>
              <div>
                <strong>Deadline Alert &amp; Alarms</strong>
                <span className="reminder-subtitle">Choose alert timing and delivery channels</span>
              </div>
            </div>

            {/* Mode Tabs */}
            <div className="reminder-mode-tabs">
              {[
                { id: 'none', label: 'No Alert' },
                { id: 'preset', label: 'Quick Preset' },
                { id: 'offset', label: 'Custom Offset' },
                { id: 'exact', label: 'Exact Date & Time' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  className={`reminder-tab ${reminderMode === tab.id ? 'active' : ''}`}
                  onClick={() => setReminderMode(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Presets */}
            {reminderMode === 'preset' && (
              <div className="preset-chips">
                {[
                  { m: 5, label: '5m before' },
                  { m: 15, label: '15m before' },
                  { m: 30, label: '30m before' },
                  { m: 60, label: '1h before' },
                  { m: 1440, label: '1 day before' }
                ].map(p => (
                  <button
                    key={p.m}
                    type="button"
                    className={`preset-chip ${reminderPresetMinutes === p.m ? 'active' : ''}`}
                    onClick={() => setReminderPresetMinutes(p.m)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            {/* Custom Offset */}
            {reminderMode === 'offset' && (
              <div className="offset-inputs-row">
                <input
                  className="form-input offset-value-input"
                  type="number"
                  min="1"
                  max="365"
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

            {/* Exact Time */}
            {reminderMode === 'exact' && (
              <div style={{ marginTop: '10px' }}>
                <input
                  className="form-input"
                  type="datetime-local"
                  value={reminderExact}
                  onChange={e => setReminderExact(e.target.value)}
                />
              </div>
            )}

            {/* Preview Chip */}
            {preview && (
              <div className="reminder-preview-chip">
                {preview.isPast ? (
                  <span>⚠️ <strong>{preview.formatted}</strong> (Time is in the past)</span>
                ) : (
                  <span>🔔 Alert triggers on: <strong>{preview.formatted}</strong></span>
                )}
              </div>
            )}

            {/* Channels Multi-Select */}
            {reminderMode !== 'none' && (
              <div className="channels-section">
                <div className="channels-section-title">Delivery Channels (Select All That Apply)</div>
                <div className="channels-grid">
                  {/* Push */}
                  <div
                    className={`channel-choice ${channels.push ? 'active' : ''}`}
                    onClick={() => toggleChannel('push')}
                  >
                    <span className="channel-choice-icon">🔔</span>
                    <div className="channel-choice-info">
                      <span className="channel-choice-name">Browser &amp; Mobile Push</span>
                      <span className="channel-choice-desc">System notification on desktop &amp; phone</span>
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <span className="channel-choice-name">Audio Bell Chime</span>
                        <button
                          type="button"
                          className="btn-sound-preview"
                          onClick={(e) => {
                            e.stopPropagation();
                            SoundFX.playReminderChime(soundEnabled);
                          }}
                          title="Click to test 5.5s reminder chime"
                        >
                          ▶ Play 5s
                        </button>
                      </div>
                      <span className="channel-choice-desc">5.5s sustained executive harmonic chime</span>
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
                      <span className="channel-choice-name">Google Calendar (.ics Sync)</span>
                      <span className="channel-choice-desc">Native device alarms on iOS, Android &amp; Windows</span>
                    </div>
                    <span className="channel-check-mark">{channels.calendar ? '✓' : ''}</span>
                  </div>

                  {/* WhatsApp */}
                  <div
                    className={`channel-choice ${channels.whatsapp ? 'active' : ''}`}
                    onClick={() => toggleChannel('whatsapp')}
                  >
                    <span className="channel-choice-icon">💬</span>
                    <div className="channel-choice-info">
                      <span className="channel-choice-name">WhatsApp Quick Note</span>
                      <span className="channel-choice-desc">Direct pre-formatted WhatsApp reminder</span>
                    </div>
                    <span className="channel-check-mark">{channels.whatsapp ? '✓' : ''}</span>
                  </div>

                  {/* Email */}
                  <div
                    className={`channel-choice ${channels.email ? 'active' : ''}`}
                    onClick={() => toggleChannel('email')}
                  >
                    <span className="channel-choice-icon">📧</span>
                    <div className="channel-choice-info">
                      <span className="channel-choice-name">Resend Automated Email</span>
                      <span className="channel-choice-desc">Delivers directly with calendar invite attached</span>
                    </div>
                    <span className="channel-check-mark">{channels.email ? '✓' : ''}</span>
                  </div>
                </div>

                {/* WhatsApp Phone Contact Field */}
                {channels.whatsapp && (
                  <div className="channel-input-card" style={{ marginTop: '10px' }}>
                    <div className="channel-input-header">
                      <span className="channel-input-badge wa">💬 WhatsApp Number</span>
                      <span className="channel-input-hint">Target phone where message will be sent (with country code)</span>
                    </div>
                    <div className="input-with-icon">
                      <span className="input-icon">📱</span>
                      <input
                        className="form-input"
                        type="tel"
                        placeholder="e.g. 7347363524 or +91 9876543210"
                        value={whatsappNumber}
                        onChange={e => setWhatsappNumber(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Email Contact Field */}
                {channels.email && (
                  <div className="channel-input-card" style={{ marginTop: '10px' }}>
                    <div className="channel-input-header">
                      <span className="channel-input-badge mail">📧 Reminder Email Address</span>
                      <span className="channel-input-hint">Destination where Resend delivers the task &amp; calendar invite</span>
                    </div>
                    <div className="input-with-icon">
                      <span className="input-icon">✉️</span>
                      <input
                        className="form-input"
                        type="email"
                        placeholder="e.g. arpitchauhan5586@gmail.com"
                        value={reminderEmail}
                        onChange={e => setReminderEmail(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" id="save-task-btn">
              <span>{taskToEdit ? 'Update Task' : 'Save Task'}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
