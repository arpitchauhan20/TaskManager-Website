import React, { useState, useEffect } from 'react';
import { sendTaskEmail } from '../services/emailService';
import { SoundFX } from '../services/soundEngine';
import {
  isGoogleCalendarConnected,
  getConnectedGoogleEmail,
  requestGoogleCalendarAccess,
  disconnectGoogleCalendar,
  saveEventToGoogleCalendar,
  fetchCalendarStatus
} from '../services/calendarService';
import {
  XIcon,
  CalendarIcon,
  MailIcon,
  LinkIcon,
  ZapIcon,
  KeyIcon,
  LogOutIcon,
  VolumeIcon,
  PlayIcon,
  CheckIcon
} from './Icons';

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
  onLogout,
  currentPalette = 'indigo',
  onChangePalette,
  soundEnabled = true,
  onToggleSound
}) {
  const [name, setName] = useState(userName || '');
  const [email, setEmail] = useState(reminderEmail || '');
  const [isTesting, setIsTesting] = useState(false);

  // Google Calendar OAuth state
  const isInitialConnected = Boolean(externalConnected || currentUser?.google_calendar_connected);
  const [gcalConnected, setGcalConnected] = useState(isInitialConnected);
  const [gcalEmail, setGcalEmail] = useState(() => getConnectedGoogleEmail() || currentUser?.email || null);
  const [isConnectingGCal, setIsConnectingGCal] = useState(false);
  const [isTestingGCal, setIsTestingGCal] = useState(false);

  const initialName = (userName || '').trim();
  const initialEmail = (reminderEmail || (currentUser?.email || '')).trim();
  const hasChanges = name.trim() !== initialName || email.trim() !== initialEmail;

  useEffect(() => {
    setName(userName || '');
    setEmail(reminderEmail || (currentUser?.email || ''));
    const isConn = Boolean(externalConnected || currentUser?.google_calendar_connected);
    setGcalConnected(isConn);
    if (isOpen) {
      fetchCalendarStatus().then(connected => {
        if (connected || currentUser?.google_calendar_connected) {
          setGcalConnected(true);
        }
      });
    }
    setGcalEmail(getConnectedGoogleEmail() || currentUser?.email || null);
  }, [userName, reminderEmail, isOpen, externalConnected, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveProfile({
      name: name.trim(),
      email: email.trim()
    });
    if (onShowToast) onShowToast('success', 'user', 'Profile and workspace settings saved');
    onClose();
  };

  const handleTestEmail = async () => {
    const target = email.trim() || currentUser?.email;
    if (!target) {
      if (onShowToast) onShowToast('error', 'alert', 'Please enter your email address before testing.');
      return;
    }

    setIsTesting(true);
    if (onShowToast) onShowToast('info', 'clock', `Sending live test email and calendar invite via Resend to ${target}...`);

    const res = await sendTaskEmail({
      recipient: target,
      title: 'TaskFlow Pro - Live Integration Test',
      description: 'This automated test confirms that TaskFlow Pro can deliver emails directly via Resend HTTPS (Port 443) and automatically add events to Google Calendar.',
      deadline: new Date(Date.now() + 2 * 3600000).toISOString(),
      priority: 'high',
      isTest: true
    });

    setIsTesting(false);
    if (res.success) {
      if (onShowToast) onShowToast('success', 'sparkles', `Test email sent to ${target}! Check your inbox.`);
    } else {
      if (onShowToast) onShowToast('error', 'alert', res.error || 'Failed to dispatch test email');
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
      if (onShowToast) onShowToast('success', 'calendar', 'Google Calendar connected! Tasks will auto-sync directly in the background.');
    } catch (err) {
      if (onShowToast) onShowToast('error', 'alert', err.message || 'Failed to authorize Google Calendar');
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
    if (onShowToast) onShowToast('info', 'info', 'Google Calendar disconnected.');
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
        if (onShowToast) onShowToast('success', 'sparkles', 'Event auto-saved directly to Google Calendar! Check calendar.google.com');
      } else {
        if (onShowToast) onShowToast('error', 'alert', res.error || 'Failed to auto-save test event');
      }
    } catch (err) {
      if (onShowToast) onShowToast('error', 'alert', err.message || 'Calendar auto-save failed');
    } finally {
      setIsTestingGCal(false);
    }
  };

  return (
    <div className="modal-overlay active" id="settings-modal" onClick={e => e.target.id === 'settings-modal' && onClose()}>
      {/* Outer Dialog Wrapper for Floating Outside Close Button */}
      <div className="modal-dialog-wrapper settings-dialog-wrapper">
        {/* Floating Outside Close Button */}
        <button
          type="button"
          className="modal-floating-close-btn"
          onClick={onClose}
          title="Close (Esc)"
          aria-label="Close"
        >
          <XIcon size={18} />
        </button>

        {/* Modal Box */}
        <div className="modal settings-modal-box">
          <div className="modal-header">
            <div>
              <h2 className="modal-title">Account &amp; Workspace Profile</h2>
              <p className="modal-subtitle">Manage appearance, sound alarms, connected services &amp; preferences</p>
            </div>
          </div>

          {/* User Status Banner */}
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
            {/* Section: Appearance & Sound */}
            <div className="settings-section-divider">
              <span className="settings-section-heading">APPEARANCE &amp; SOUND</span>
            </div>

            {/* Unified Appearance & Sound Card */}
            <div className="settings-card-section">
              {/* 1. Theme Color Selector */}
              <div>
                <div style={{ marginBottom: '8px' }}>
                  <strong className="settings-card-title">Color Theme</strong>
                  <div className="settings-card-desc">Personalize your workspace palette</div>
                </div>
                <div className="settings-theme-grid">
                  {[
                    { id: 'indigo', label: 'Obsidian Indigo', color: '#6366f1', bg: '#080b11' },
                    { id: 'emerald', label: 'Emerald Forest', color: '#10b981', bg: '#050d09' },
                    { id: 'cyan', label: 'Midnight Cyan', color: '#00bcd4', bg: '#060b13' },
                    { id: 'violet', label: 'Nebula Violet', color: '#a855f7', bg: '#0a0614' }
                  ].map(theme => (
                    <button
                      key={theme.id}
                      type="button"
                      className={`settings-theme-option ${currentPalette === theme.id ? 'active' : ''}`}
                      onClick={() => onChangePalette && onChangePalette(theme.id)}
                    >
                      <div className="theme-option-preview" style={{ background: theme.bg }}>
                        <div className="theme-option-accent" style={{ background: theme.color }} />
                      </div>
                      <span className="theme-option-name">{theme.label}</span>
                      {currentPalette === theme.id && (
                        <span className="theme-option-check">
                          <CheckIcon size={13} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inner Divider */}
              <div className="settings-card-inner-divider" />

              {/* 2. Sound & Alerts with Toggle Switch */}
              <div className="settings-sound-row">
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <VolumeIcon size={18} style={{ color: soundEnabled ? 'var(--accent-light, #818cf8)' : 'var(--text-tertiary, #64748b)' }} />
                    <strong className="settings-card-title">Audio Bell &amp; Alert Chimes</strong>
                  </div>
                  <div className="settings-card-desc">
                    Play harmonic audio chime on deadline alarms and task completion
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn-sound-preview"
                    onClick={() => SoundFX.playReminderChime(true)}
                    title="Test sound chime"
                  >
                    <PlayIcon size={9} style={{ marginRight: '4px' }} />
                    Test
                  </button>

                  <label className="settings-switch" title={soundEnabled ? 'Disable Sound' : 'Enable Sound'}>
                    <input
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={onToggleSound}
                    />
                    <span className="settings-slider" />
                  </label>
                </div>
              </div>
            </div>

            {/* Section: Connect With */}
            <div className="settings-section-divider" style={{ marginTop: '20px' }}>
              <span className="settings-section-heading">CONNECT WITH</span>
            </div>

            {/* Unified Integrations Card */}
            <div className="settings-card-section">
              {/* 1. Google Calendar Integration */}
              <div className="settings-sub-section">
                <div className="settings-card-header">
                  <div className="settings-card-icon-wrap cal">
                    <CalendarIcon size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong className="settings-card-title">Google Calendar</strong>
                    <div className="settings-card-desc">
                      {gcalConnected
                        ? `Connected (${gcalEmail || 'Active Session'}) | 1-click & background auto-sync active`
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
                      <LinkIcon size={14} style={{ marginRight: '4px' }} />
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
                        <ZapIcon size={13} style={{ marginRight: '4px' }} />
                        <span>{isTestingGCal ? 'Saving...' : 'Test Calendar Sync'}</span>
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

              {/* Inner Divider */}
              <div className="settings-card-inner-divider" />

              {/* 2. Automated Resend Email Dispatcher */}
              <div className="settings-sub-section">
                <div className="settings-card-header">
                  <div className="settings-card-icon-wrap email">
                    <MailIcon size={20} />
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
                    <ZapIcon size={13} style={{ marginRight: '4px' }} />
                    <span>{isTesting ? 'Dispatching...' : 'Send Test Email & Invite'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Section: Profile Preferences */}
            <div className="settings-section-divider" style={{ marginTop: '20px' }}>
              <span className="settings-section-heading">PROFILE PREFERENCES</span>
            </div>

            {/* Display Name & Default Email in 2-Column Grid */}
            <div className="settings-form-row-2col">
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
                      <KeyIcon size={13} style={{ marginRight: '4px' }} />
                      Change Password
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
                  <LogOutIcon size={14} style={{ marginRight: '4px' }} />
                  Sign Out
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!hasChanges}
                style={{
                  opacity: hasChanges ? 1 : 0.35,
                  cursor: hasChanges ? 'pointer' : 'not-allowed',
                  boxShadow: hasChanges ? '0 4px 14px rgba(99, 102, 241, 0.4)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
