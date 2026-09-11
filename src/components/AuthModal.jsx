import React, { useState, useEffect } from 'react';
import { AuthClient } from '../services/authClient';

// Eye icon SVGs for show/hide toggle
const EyeOpen = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeClosed = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const eyeToggleStyle = {
  position: 'absolute',
  right: '10px',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  color: 'var(--text-tertiary, #64748b)',
  cursor: 'pointer',
  padding: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '4px',
  transition: 'color 0.2s ease'
};

const passwordInputWrapperStyle = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center'
};

export default function AuthModal({
  isOpen,
  onClose,
  initialMode = 'login', // 'login' | 'register' | 'forgot' | 'reset' | 'change-password'
  resetToken = '',
  currentUser,
  onAuthSuccess,
  onShowToast
}) {
  const [mode, setMode] = useState(initialMode);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [tokenInput, setTokenInput] = useState(resetToken || '');

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  useEffect(() => {
    setMode(initialMode);
    setErrorMessage('');
    setInfoMessage('');
    if (resetToken) {
      setTokenInput(resetToken);
      setMode('reset');
    }
  }, [initialMode, resetToken, isOpen]);

  // Reset visibility states on mode switch
  useEffect(() => {
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowCurrentPassword(false);
  }, [mode]);

  if (!isOpen) return null;

  const resetForm = () => {
    setPassword('');
    setConfirmPassword('');
    setCurrentPassword('');
    setErrorMessage('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowCurrentPassword(false);
  };

  const handleSwitchMode = (newMode) => {
    resetForm();
    setInfoMessage('');
    setMode(newMode);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await AuthClient.login({ email, password });
        onAuthSuccess(res.user);
        onShowToast('success', '👋', `Welcome back, ${res.user.name || 'Executive'}!`);
        onClose();
      } else if (mode === 'register') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match. Please verify.');
        }
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters long.');
        }
        const res = await AuthClient.register({ name, email, password });
        onAuthSuccess(res.user);
        onShowToast('success', '🎉', `Account created! Welcome, ${res.user.name}.`);
        onClose();
      } else if (mode === 'forgot') {
        const res = await AuthClient.forgotPassword(email);
        if (res.resetUrl) {
          // Dev mode: show the reset link directly
          setInfoMessage(`Reset link generated! In development mode, use this link:\n${res.resetUrl}`);
        } else {
          setInfoMessage(res.message || 'If an account exists with that email, a password reset link has been sent. Check your inbox and spam folder.');
        }
        onShowToast('info', '📧', 'Password reset instructions dispatched.');
      } else if (mode === 'reset') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match. Please verify.');
        }
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters long.');
        }
        const res = await AuthClient.resetPassword({
          token: tokenInput.trim(),
          newPassword: password
        });
        onShowToast('success', '🔑', res.message || 'Password reset successfully!');
        setInfoMessage('Password updated! You can now sign in with your new password.');
        setMode('login');
      } else if (mode === 'change-password') {
        if (password !== confirmPassword) {
          throw new Error('New passwords do not match. Please verify.');
        }
        if (password.length < 8) {
          throw new Error('New password must be at least 8 characters long.');
        }
        const res = await AuthClient.changePassword({
          currentPassword,
          newPassword: password
        });
        onShowToast('success', '🛡️', res.message || 'Password changed successfully!');
        onClose();
      }
    } catch (err) {
      setErrorMessage(err.message || 'Action failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getTitles = () => {
    switch (mode) {
      case 'register':
        return {
          title: 'Create an Account',
          subtitle: 'Join TaskFlow Pro to sync tasks, deadlines, and automated reminders'
        };
      case 'forgot':
        return {
          title: 'Forgot Password',
          subtitle: 'Enter your account email to receive a secure password reset link'
        };
      case 'reset':
        return {
          title: 'Reset Password',
          subtitle: 'Create a strong, new password for your TaskFlow Pro account'
        };
      case 'change-password':
        return {
          title: 'Change Password',
          subtitle: 'Update your account password securely'
        };
      default:
        return {
          title: 'Sign In to TaskFlow Pro',
          subtitle: 'Enter your credentials to access your workspaces and synchronized alerts'
        };
    }
  };

  const { title, subtitle } = getTitles();

  return (
    <div
      className="modal-overlay active"
      id="auth-modal"
      onClick={e => e.target.id === 'auth-modal' && onClose()}
    >
      <div className="modal modal-md auth-modal-box">
        <div className="modal-handle" />

        <div className="modal-header">
          <div>
            <h2 className="modal-title">{title}</h2>
            <p className="modal-subtitle">{subtitle}</p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        {/* Tab Toggle for Login / Register */}
        {(mode === 'login' || mode === 'register') && (
          <div className="auth-tab-bar" style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
            <button
              type="button"
              className={`btn btn-sm ${mode === 'login' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => handleSwitchMode('login')}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`btn btn-sm ${mode === 'register' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => handleSwitchMode('register')}
            >
              Register
            </button>
          </div>
        )}

        {/* Status Messages */}
        {errorMessage && (
          <div className="auth-alert-box error" style={{
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#fb7185',
            fontSize: '13px',
            marginBottom: '16px'
          }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {infoMessage && (
          <div className="auth-alert-box info" style={{
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#38bdf8',
            fontSize: '13px',
            marginBottom: '16px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>
            ℹ️ {infoMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Register: Name */}
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-name-input">
                Full Name <span className="required-star">*</span>
              </label>
              <input
                id="auth-name-input"
                className="form-input"
                type="text"
                placeholder="e.g. John Doe"
                maxLength="50"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
          )}

          {/* Email (Login, Register, Forgot) */}
          {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-email-input">
                Email Address <span className="required-star">*</span>
              </label>
              <input
                id="auth-email-input"
                className="form-input"
                type="email"
                placeholder="e.g. john@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus={mode !== 'register'}
              />
            </div>
          )}

          {/* Change Password: Current Password */}
          {mode === 'change-password' && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-current-pw">
                Current Password <span className="required-star">*</span>
              </label>
              <div style={passwordInputWrapperStyle}>
                <input
                  id="auth-current-pw"
                  className="form-input"
                  type={showCurrentPassword ? 'text' : 'password'}
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  autoFocus
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  style={eyeToggleStyle}
                  title={showCurrentPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showCurrentPassword ? <EyeOpen /> : <EyeClosed />}
                </button>
              </div>
            </div>
          )}

          {/* Password (Login, Register, Reset, Change) */}
          {mode !== 'forgot' && (
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" htmlFor="auth-password-input">
                  {mode === 'change-password' || mode === 'reset' ? 'New Password' : 'Password'}{' '}
                  <span className="required-star">*</span>
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('forgot')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-light, #818cf8)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div style={passwordInputWrapperStyle}>
                <input
                  id="auth-password-input"
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'register' || mode === 'reset' || mode === 'change-password' ? 'Min 8 characters (letters & numbers)' : 'Enter password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={eyeToggleStyle}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOpen /> : <EyeClosed />}
                </button>
              </div>
            </div>
          )}

          {/* Confirm Password (Register, Reset, Change) */}
          {(mode === 'register' || mode === 'reset' || mode === 'change-password') && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-confirm-pw">
                Confirm {mode === 'change-password' || mode === 'reset' ? 'New Password' : 'Password'}{' '}
                <span className="required-star">*</span>
              </label>
              <div style={passwordInputWrapperStyle}>
                <input
                  id="auth-confirm-pw"
                  className="form-input"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={eyeToggleStyle}
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOpen /> : <EyeClosed />}
                </button>
              </div>
            </div>
          )}

          {/* Reset Token Input (if not already embedded) */}
          {mode === 'reset' && !resetToken && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-token-input">
                Reset Token <span className="required-star">*</span>
              </label>
              <input
                id="auth-token-input"
                className="form-input"
                type="text"
                placeholder="Paste the reset token from your email"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                required
              />
            </div>
          )}

          {/* Actions */}
          <div className="modal-actions" style={{ marginTop: '20px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ minWidth: '120px' }}
            >
              <span>
                {loading
                  ? 'Processing...'
                  : mode === 'login'
                  ? 'Sign In'
                  : mode === 'register'
                  ? 'Create Account'
                  : mode === 'forgot'
                  ? 'Send Reset Link'
                  : mode === 'reset'
                  ? 'Reset Password'
                  : 'Update Password'}
              </span>
            </button>
          </div>

          {/* Bottom Footer Switches */}
          <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-tertiary, #64748b)' }}>
            {mode === 'login' && (
              <span>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('register')}
                  style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                >
                  Create one now
                </button>
              </span>
            )}
            {mode === 'register' && (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                >
                  Sign in
                </button>
              </span>
            )}
            {(mode === 'forgot' || mode === 'reset') && (
              <button
                type="button"
                onClick={() => handleSwitchMode('login')}
                style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontWeight: 600, padding: 0 }}
              >
                ← Back to Sign In
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
