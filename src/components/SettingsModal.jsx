import React, { useState, useEffect } from 'react';
import { sendTaskEmail } from '../services/emailService';

export default function SettingsModal({
  isOpen,
  onClose,
  userName,
  whatsappNumber,
  reminderEmail,
  onSaveProfile,
  onShowToast
}) {
  const [name, setName] = useState(userName || '');
  const [wa, setWa] = useState(whatsappNumber || '');
  const [email, setEmail] = useState(reminderEmail || '');
  const [isTesting, setIsTesting] = useState(false);
  const [feedCopied, setFeedCopied] = useState(false);

  useEffect(() => {
    setName(userName || '');
    setWa(whatsappNumber || '');
    setEmail(reminderEmail || '');
  }, [userName, whatsappNumber, reminderEmail, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveProfile({
      name: name.trim(),
      whatsapp: wa.trim(),
      email: email.trim()
    });
    onShowToast('success', '👤', 'Profile and automation settings saved');
    onClose();
  };

  const handleTestEmail = async () => {
    setIsTesting(true);
    onShowToast('info', '⏳', 'Sending live test email and calendar invite via Resend...');

    const res = await sendTaskEmail({
      recipient: email.trim() || 'arpitchauhan5586@gmail.com',
      title: 'TaskFlow Pro — Live Integration Test',
      description: 'This automated test confirms that TaskFlow Pro can deliver emails directly via Resend HTTPS (Port 443) and automatically add events to Google Calendar.',
      deadline: new Date(Date.now() + 2 * 3600000).toISOString(),
      priority: 'high',
      isTest: true
    });

    setIsTesting(false);
    if (res.success) {
      onShowToast('success', '🎉', `Test email sent to ${email || 'arpitchauhan5586@gmail.com'}! Check your inbox.`);
    } else {
      onShowToast('error', '❌', res.error || 'Failed to dispatch test email');
    }
  };

  const handleCopyFeed = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://task-manager-website-psi.vercel.app';
    const feedUrl = `${origin}/api/calendar.ics`;
    navigator.clipboard.writeText(feedUrl).then(() => {
      setFeedCopied(true);
      onShowToast('success', '📋', 'Calendar feed URL copied! In Google Calendar: Other calendars (+) > From URL');
      setTimeout(() => setFeedCopied(false), 3000);
    });
  };

  return (
    <div className="modal-overlay active" id="settings-modal" onClick={e => e.target.id === 'settings-modal' && onClose()}>
      <div className="modal modal-md">
        <div className="modal-handle" />

        <div className="modal-header">
          <div>
            <h2 className="modal-title">Settings &amp; Automation</h2>
            <p className="modal-subtitle">Profile preferences, Resend HTTPS API &amp; Google Calendar sync</p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Display Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="settings-name-input">
              Your Display Name
            </label>
            <input
              id="settings-name-input"
              className="form-input"
              type="text"
              maxLength="30"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          {/* Default WhatsApp */}
          <div className="form-group">
            <label className="form-label" htmlFor="settings-wa-input">
              Default WhatsApp Number (Optional)
            </label>
            <input
              id="settings-wa-input"
              className="form-input"
              type="tel"
              placeholder="e.g. 7347363524 or +91 9876543210"
              value={wa}
              onChange={e => setWa(e.target.value)}
            />
          </div>

          {/* Default Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="settings-email-input">
              Default Reminder Email (Optional)
            </label>
            <input
              id="settings-email-input"
              className="form-input"
              type="email"
              placeholder="e.g. arpitchauhan5586@gmail.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          {/* Automated Resend Sending Card */}
          <div className="settings-card-section">
            <div className="settings-card-header">
              <span className="settings-card-icon">⚡</span>
              <div>
                <strong>Resend HTTPS Email Dispatcher</strong>
                <div className="settings-card-desc">Delivers emails over Port 443 — Bypasses all ISP blocks</div>
              </div>
              <span className="badge-status-pill active" id="email-cfg-badge">
                Active (Port 443)
              </span>
            </div>

            <p className="form-hint" style={{ marginTop: '8px' }}>
              Configured via <code>RESEND_API_KEY</code> environment variable. Ready for 1-click Vercel deployment.
            </p>

            <div className="btn-group-row" style={{ marginTop: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleTestEmail}
                disabled={isTesting}
              >
                <span>{isTesting ? '⏳ Dispatching...' : '⚡ Test Resend & Calendar Invite'}</span>
              </button>
            </div>
          </div>

          {/* Hands-Free Google Calendar Sync Card */}
          <div className="settings-card-section" style={{ marginTop: '12px' }}>
            <div className="settings-card-header">
              <span className="settings-card-icon">📅</span>
              <div>
                <strong>Hands-Free Google Calendar Sync</strong>
                <div className="settings-card-desc">Sync all tasks and alarms automatically</div>
              </div>
            </div>
            <p className="calendar-help-text">
              1. <strong>Automatic Invites:</strong> Every task email contains an event invite (.ics) that Google Calendar automatically detects and adds.<br />
              2. <strong>1-Click Button:</strong> Click the 📅 icon on any task to instantly open and save it in Google Calendar.<br />
              3. <strong>Live Feed URL:</strong> Or subscribe in Google Calendar (<em>Add other calendar &gt; From URL</em>):
            </p>
            <div className="copy-url-box">
              <input
                className="form-input feed-url-input"
                type="text"
                readOnly
                value={typeof window !== 'undefined' ? `${window.location.origin}/api/calendar.ics` : '/api/calendar.ics'}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCopyFeed}
              >
                {feedCopied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="modal-actions" style={{ marginTop: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
