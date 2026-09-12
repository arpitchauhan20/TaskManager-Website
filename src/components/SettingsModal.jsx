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
  onShowToast,
  isCalendarConnected: externalConnected,
  isCalendarLoading = false,
  onConnectCalendar,
  onDisconnectCalendar,
  currentUser,
  onOpenAuthModal,
  onLogout
}) {
  const [name, setName] = useState(userName || '');
  const [email, setEmail] = useState(reminderEmail || '');
  const [isTesting, setIsTesting] = useState(false);

  // Google Calendar OAuth state
  const isConnected = externalConnected !== undefined ? externalConnected : isGoogleCalendarConnected();
  const [gcalConnected, setGcalConnected] = useState(isConnected);
  const [gcalEmail, setGcalEmail] = useState(() => getConnectedGoogleEmail());
  const [isConnectingGCal, setIsConnectingGCal] = useState(false);
  const [isTestingGCal, setIsTestingGCal] = useState(false);

  useEffect(() => {
    setName(userName || '');
    setEmail(reminderEmail || (currentUser?.email || ''));
    setGcalConnected(externalConnected !== undefined ? externalConnected : isGoogleCalendarConnected());
    setGcalEmail(getConnectedGoogleEmail());
  }, [userName, reminderEmail, isOpen, externalConnected, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveProfile({
      name: name.trim(),
      email: email.trim()
    });
    if (onShowToast) onShowToast('success', '👤', 'Profile and automation settings saved');
    onClose();
  };

  const handleTestEmail = async () => {
    const target = email.trim() || currentUser?.email;
    if (!target) {
      if (onShowToast) onShowToast('error', '⚠️', 'Please enter your email address in the field above before testing.');
      return;
    }

    setIsTesting(true);
    if (onShowToast) onShowToast('info', '⏳', `Sending live test email and calendar invite via Resend to ${target}...`);

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
      if (onShowToast) onShowToast('success', '🎉', `Test email sent to ${target}! Check your inbox.`);
    } else {
      if (onShowToast) onShowToast('error', '❌', res.error || 'Failed to dispatch test email');
    }
  };

  const handleConnectGoogle = async () => {
    if (onConnectCalendar) {
      onConnectCalendar();
      return;
    }
    setIsConnectingGCal(true);
    try {
      await requestGoogleCalendarAccess({ promptConsent: true });
      setGcalConnected(true);
      setGcalEmail(getConnectedGoogleEmail());
      if (onShowToast) onShowToast('success', '📅', 'Google Calendar connected! Tasks will now auto-save directly in the background.');
    } catch (err) {
      if (onShowToast) onShowToast('error', '❌', err.message || 'Failed to authorize Google Calendar');
    } finally {
      setIsConnectingGCal(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (onDisconnectCalendar) {
      await onDisconnectCalendar();
      setGcalConnected(false);
      setGcalEmail(null);
      return;
    }
    disconnectGoogleCalendar();
    setGcalConnected(false);
    setGcalEmail(null);
    if (onShowToast) onShowToast('info', 'ℹ️', 'Google Calendar disconnected.');
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
        if (onShowToast) onShowToast('success', '🎉', 'Event auto-saved directly to Google Calendar! Check calendar.google.com');
      } else {
        if (onShowToast) onShowToast('error', '❌', res.error || 'Failed to auto-save test event');
      }
    } catch (err) {
      if (onShowToast) onShowToast('error', '❌', err.message || 'Calendar auto-save failed');
    } finally {
      setIsTestingGCal(false);
    }
  };

  return (
    <div className="modal-overlay active" id="settings-modal" onClick={e => e.target.id === 'settings-modal' && onClose()}>
      <div className="modal modal-md settings-modal-box">
        <div className="modal-handle" />

        <div className="modal-header">
          <div>
            <h2 className="modal-title">Account &amp; Connected Services</h2>
            <p className="modal-subtitle">Connect Google Calendar, Resend Email dispatch &amp; manage your profile</p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        {/* User Status Bar if Logged In */}
        {currentUser ? (
          <div className="settings-user-banner">
            <div className="settings-user-avatar">
              {(currentUser.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="settings-user-meta">
              <span className="settings-user-name">{currentUser.name}</span>
              <span className="settings-user-email">{currentUser.email}</span>
            </div>
            <span className="badge-status-pill active" style={{ marginLeft: 'auto' }}>
              ✓ Signed In
            </span>
          </div>
        ) : (
          <div className="settings-user-banner guest">
            <div className="settings-user-meta">
              <span className="settings-user-name">Local Guest Session</span>
              <span className="settings-user-email">Sign in to securely sync tasks across devices</span>
            </div>
            {onOpenAuthModal && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  onClose();
                  onOpenAuthModal('login');
                }}
                style={{ marginLeft: 'auto' }}
              >
                Sign In
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Section: Connect With */}
          <div className="settings-section-divider">
            <span className="settings-section-heading">CONNECT WITH</span>
          </div>

          {/* 1. Google Calendar Integration Card */}
          <div className="settings-card-section gcal-card-section">
            <div className="settings-card-header">
              <div className="settings-card-icon-wrap cal">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong className="settings-card-title">Google Calendar</strong>
                <div className="settings-card-desc">
                  {gcalConnected
                    ? `Connected (${gcalEmail || 'Active Session'}) — 1-click & background auto-sync active`
                    : 'Connect your Google account to sync scheduled tasks and reminders'}
                </div>
              </div>
              <span className={`badge-status-pill ${gcalConnected ? 'active' : ''}`}>
                {gcalConnected ? '✓ Connected' : 'Disconnected'}
              </span>
            </div>

            <div className="btn-group-row" style={{ marginTop: '12px', justifyContent: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
              {!gcalConnected ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleConnectGoogle}
                  disabled={isConnectingGCal || isCalendarLoading}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  <span>{isConnectingGCal || isCalendarLoading ? 'Connecting...' : 'Connect Google Calendar'}</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleTestGoogleCalendar}
                    disabled={isTestingGCal}
                  >
                    <span>{isTestingGCal ? '⏳ Saving...' : '⚡ Test Calendar Sync'}</span>
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

          {/* 2. Automated Resend Email Dispatcher */}
          <div className="settings-card-section email-card-section" style={{ marginTop: '12px' }}>
            <div className="settings-card-header">
              <div className="settings-card-icon-wrap email">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong className="settings-card-title">Resend Email &amp; Calendar Invites</strong>
                <div className="settings-card-desc">Delivers instant task notifications &amp; calendar invite attachments over Port 443</div>
              </div>
              <span className="badge-status-pill active" id="email-cfg-badge">
                Active (Port 443)
              </span>
            </div>

            <div className="btn-group-row" style={{ marginTop: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleTestEmail}
                disabled={isTesting}
              >
                <span>{isTesting ? '⏳ Dispatching...' : '⚡ Send Test Email & Invite'}</span>
              </button>
            </div>
          </div>

          {/* Section: Profile & Preferences */}
          <div className="settings-section-divider" style={{ marginTop: '20px' }}>
            <span className="settings-section-heading">PROFILE PREFERENCES</span>
          </div>

          {/* Display Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="settings-name-input">
              Display Name
            </label>
            <input
              id="settings-name-input"
              className="form-input"
              type="text"
              maxLength="30"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Alex Rivera"
              required
            />
          </div>

          {/* Default Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="settings-email-input">
              Default Notification / Calendar Email
            </label>
            <input
              id="settings-email-input"
              className="form-input"
              type="email"
              placeholder="e.g. yourname@gmail.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          {/* Security & Password section for logged-in users */}
          {currentUser && (
            <>
              <div className="settings-section-divider" style={{ marginTop: '20px' }}>
                <span className="settings-section-heading">SECURITY &amp; ACCESS</span>
              </div>

              <div className="settings-security-row">
                <div className="security-info">
                  <span className="security-title">Password Management</span>
                  <span className="security-desc">Update your login password securely</span>
                </div>
                {onOpenAuthModal && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      onClose();
                      onOpenAuthModal('change-password');
                    }}
                  >
                    🔑 Change Password
                  </button>
                )}
              </div>
            </>
          )}

          {/* Modal Actions */}
          <div className="modal-actions" style={{ marginTop: '22px' }}>
            {currentUser && onLogout && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginRight: 'auto', color: '#fb7185' }}
                onClick={() => {
                  onClose();
                  onLogout();
                }}
              >
                🚪 Sign Out
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
