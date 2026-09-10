import React, { useState, useEffect } from 'react';
import { sendTaskEmail } from '../services/emailService';
import {
  isGoogleCalendarConnected,
  getConnectedGoogleEmail,
  requestGoogleCalendarAccess,
  disconnectGoogleCalendar,
  saveEventToGoogleCalendar
} from '../services/calendarService';

export default function SettingsModal({
  isOpen,
  onClose,
  userName,
  reminderEmail,
  onSaveProfile,
  onShowToast
}) {
  const [name, setName] = useState(userName || '');
  const [email, setEmail] = useState(reminderEmail || '');
  const [isTesting, setIsTesting] = useState(false);

  // Google Calendar OAuth state
  const [gcalConnected, setGcalConnected] = useState(() => isGoogleCalendarConnected());
  const [gcalEmail, setGcalEmail] = useState(() => getConnectedGoogleEmail());
  const [isConnectingGCal, setIsConnectingGCal] = useState(false);
  const [isTestingGCal, setIsTestingGCal] = useState(false);

  useEffect(() => {
    setName(userName || '');
    setEmail(reminderEmail || '');
    setGcalConnected(isGoogleCalendarConnected());
    setGcalEmail(getConnectedGoogleEmail());
  }, [userName, reminderEmail, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveProfile({
      name: name.trim(),
      email: email.trim()
    });
    onShowToast('success', '👤', 'Profile and automation settings saved');
    onClose();
  };

  const handleTestEmail = async () => {
    const target = email.trim();
    if (!target) {
      onShowToast('error', '⚠️', 'Please enter your email address in the field above before testing.');
      return;
    }

    setIsTesting(true);
    onShowToast('info', '⏳', `Sending live test email and calendar invite via Resend to ${target}...`);

    const res = await sendTaskEmail({
      recipient: target,
      title: 'TaskFlow Pro — Live Integration Test',
      description: 'This automated test confirms that TaskFlow Pro can deliver emails directly via Resend HTTPS (Port 443) and automatically add events to Google Calendar.',
      deadline: new Date(Date.now() + 2 * 3600000).toISOString(),
      priority: 'high',
      isTest: true
    });

    setIsTesting(false);
    if (res.success) {
      onShowToast('success', '🎉', `Test email sent to ${target}! Check your inbox.`);
    } else {
      onShowToast('error', '❌', res.error || 'Failed to dispatch test email');
    }
  };

  const handleConnectGoogle = async () => {
    setIsConnectingGCal(true);
    try {
      await requestGoogleCalendarAccess({ promptConsent: true });
      setGcalConnected(true);
      setGcalEmail(getConnectedGoogleEmail());
      onShowToast('success', '📅', 'Google Calendar connected! Tasks will now auto-save directly in the background.');
    } catch (err) {
      onShowToast('error', '❌', err.message || 'Failed to authorize Google Calendar');
    } finally {
      setIsConnectingGCal(false);
    }
  };

  const handleDisconnectGoogle = () => {
    disconnectGoogleCalendar();
    setGcalConnected(false);
    setGcalEmail(null);
    onShowToast('info', 'ℹ️', 'Google Calendar disconnected.');
  };

  const handleTestGoogleCalendar = async () => {
    setIsTestingGCal(true);
    try {
      const res = await saveEventToGoogleCalendar({
        title: 'TaskFlow Pro Live Test Event',
        description: 'Auto-saved directly via Google Calendar REST API without opening new tabs!',
        deadline: new Date(Date.now() + 3600000).toISOString(),
        priority: 'high',
        reminderMode: 'preset',
        reminderPresetMinutes: 15
      });
      if (res.success) {
        onShowToast('success', '🎉', 'Event auto-saved directly to Google Calendar! Check calendar.google.com');
      } else {
        onShowToast('error', '❌', res.error || 'Failed to auto-save test event');
      }
    } catch (err) {
      onShowToast('error', '❌', err.message || 'Calendar auto-save failed');
    } finally {
      setIsTestingGCal(false);
    }
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

          {/* Default Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="settings-email-input">
              Default Reminder Email (Optional)
            </label>
            <input
              id="settings-email-input"
              className="form-input"
              type="email"
              placeholder="e.g. client@gmail.com"
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

          {/* Direct Google Calendar OAuth Sync Card */}
          <div className="settings-card-section" style={{ marginTop: '12px' }}>
            <div className="settings-card-header">
              <span className="settings-card-icon">📅</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>Direct Google Calendar Auto-Save</strong>
                <div className="settings-card-desc">
                  {gcalConnected
                    ? `Connected: ${gcalEmail || 'Active Session'} — Events save silently in the background`
                    : 'Auto-saves tasks directly to Google Calendar without opening new tabs'}
                </div>
              </div>
              <span className={`badge-status-pill ${gcalConnected ? 'active' : ''}`}>
                {gcalConnected ? '✓ Connected' : 'Not Linked'}
              </span>
            </div>

            <div className="btn-group-row" style={{ marginTop: '12px', justifyContent: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
              {!gcalConnected ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleConnectGoogle}
                  disabled={isConnectingGCal}
                >
                  <span>{isConnectingGCal ? '⏳ Authorizing...' : '🔗 Connect Google Calendar'}</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleTestGoogleCalendar}
                    disabled={isTestingGCal}
                  >
                    <span>{isTestingGCal ? '⏳ Saving...' : '⚡ Test Direct Auto-Save'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleDisconnectGoogle}
                    style={{ color: '#f43f5e' }}
                  >
                    Disconnect
                  </button>
                </>
              )}
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
