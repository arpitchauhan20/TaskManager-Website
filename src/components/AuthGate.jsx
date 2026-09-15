import React, { useState, useEffect } from 'react';
import { triggerDualCornerCelebration } from '../services/celebrationService';
import { AuthClient } from '../services/authClient';
import {
  ZapIcon,
  SparklesIcon,
  CalendarIcon,
  BellIcon,
  CheckIcon,
  LockIcon,
  UserIcon,
  MailIcon,
  ClockIcon,
  AlertTriangleIcon,
  InfoIcon,
  RefreshCwIcon,
  ArrowLeftIcon
} from './Icons';

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

export default function AuthGate({
  initialMode = 'login',
  initialResetToken = '',
  onAuthSuccess,
  onShowToast
}) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register' | 'forgot' | 'reset'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tokenInput, setTokenInput] = useState(initialResetToken || '');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  useEffect(() => {
    if (initialResetToken) {
      setTokenInput(initialResetToken);
      setMode('reset');
    }
  }, [initialResetToken]);

  const switchMode = (newMode) => {
    setErrorMessage('');
    setInfoMessage('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setMode(newMode);
  };

  const triggerConfetti = () => {
    triggerDualCornerCelebration({ duration: 3200 });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await AuthClient.login({ email, password });
        triggerConfetti();
        if (onShowToast) {
          onShowToast('success', '✨', `Welcome back, ${res.user.name || 'Executive'}!`);
        }
        onAuthSuccess(res.user);
      } else if (mode === 'register') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match. Please verify.');
        }
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters long.');
        }
        const res = await AuthClient.register({ name, email, password });
        triggerConfetti();
        if (onShowToast) {
          onShowToast('success', '✨', `Welcome to TaskFlow, ${res.user.name}!`);
        }
        onAuthSuccess(res.user);
      } else if (mode === 'forgot') {
        const res = await AuthClient.forgotPassword(email);
        if (res.resetUrl) {
          setInfoMessage(`Reset link generated! In development mode, use:\n${res.resetUrl}`);
        } else {
          setInfoMessage(res.message || 'If an account exists with that email, a password reset link has been dispatched to your inbox.');
        }
        if (onShowToast) {
          onShowToast('info', '✉️', 'Password reset instructions dispatched.');
        }
      } else if (mode === 'reset') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match. Please verify.');
        }
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters long.');
        }
        const res = await AuthClient.resetPassword({
          token: tokenInput,
          newPassword: password
        });
        triggerConfetti();
        if (onShowToast) {
          onShowToast('success', '🔑', 'Password updated successfully! Welcome back.');
        }
        onAuthSuccess(res.user);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Authentication request failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  // Password requirements calculation
  const passHasLength = password.length >= 8;
  const passHasNumber = /\d/.test(password);
  const passHasMatch = password && confirmPassword && password === confirmPassword;

  return (
    <div className="authgate-root">
      {/* Dynamic Background Ambient Glow Orbs */}
      <div className="authgate-bg-glow orb-1" />
      <div className="authgate-bg-glow orb-2" />
      <div className="authgate-bg-glow orb-3" />
      <div className="authgate-bg-mesh" />

      {/* Main Glass Portal Container */}
      <div className="authgate-container">
        
        {/* Left Side: Brand Showcase & Interactive Feature Highlights */}
        <div className="authgate-showcase">
          <div className="authgate-brand-header">
            <div className="authgate-logo-badge">
              <div className="authgate-logo-icon">
                <ZapIcon size={22} />
              </div>
              <div className="authgate-logo-text">
                <span className="authgate-logo-title">TaskFlow</span>
                <span className="authgate-logo-tag">PRO</span>
              </div>
            </div>
            <span className="authgate-edition-pill">v2.0 Executive Edition</span>
          </div>

          <div className="authgate-hero-text">
            <h1 className="authgate-headline">
              Executive Task Management <br />
              <span className="text-gradient-neon">Reimagined for Leaders.</span>
            </h1>
            <p className="authgate-subtext">
              Synchronize high-priority execution, automate Google Calendar events, and trigger smart deadline reminders across all your devices.
            </p>
          </div>

          {/* Feature Showcase Cards */}
          <div className="authgate-feature-cards">
            <div className="authgate-feature-card">
              <div className="authgate-feature-icon cal">
                <CalendarIcon size={20} />
              </div>
              <div className="authgate-feature-info">
                <div className="authgate-feature-title-row">
                  <h4>Google Calendar Bi-Directional Sync</h4>
                  <span className="authgate-mini-badge">Automated</span>
                </div>
                <p>Instantly export deadlines to Google Calendar or schedule with one-click ICS exports.</p>
              </div>
            </div>

            <div className="authgate-feature-card">
              <div className="authgate-feature-icon bell">
                <BellIcon size={20} />
              </div>
              <div className="authgate-feature-info">
                <div className="authgate-feature-title-row">
                  <h4>Intelligent Alert Dispatcher</h4>
                  <span className="authgate-mini-badge highlight">Zero Drift</span>
                </div>
                <p>Auditory chimes, push alerts, and direct Resend email deliveries configured to your schedule.</p>
              </div>
            </div>

            <div className="authgate-feature-card">
              <div className="authgate-feature-icon zap">
                <ClockIcon size={20} />
              </div>
              <div className="authgate-feature-info">
                <div className="authgate-feature-title-row">
                  <h4>Execution Telemetry</h4>
                  <span className="authgate-mini-badge">Encrypted</span>
                </div>
                <p>Live priority streams, overdue mitigation, and focus analytics built for peak clarity.</p>
              </div>
            </div>
          </div>

          {/* Social Proof & Trust Strip */}
          <div className="authgate-trust-footer">
            <div className="authgate-avatar-stack">
              <div className="avatar av-1">JD</div>
              <div className="avatar av-2">AC</div>
              <div className="avatar av-3">EM</div>
              <div className="avatar av-4">SR</div>
            </div>
            <div className="authgate-trust-text">
              <div className="authgate-stars">★★★★★</div>
              <span>Trusted by executive teams &amp; independent builders</span>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form Card */}
        <div className="authgate-card">
          {/* Form Mode Selector Tabs */}
          {(mode === 'login' || mode === 'register') && (
            <div className="authgate-tab-pills">
              <button
                type="button"
                className={`authgate-tab-btn ${mode === 'login' ? 'active' : ''}`}
                onClick={() => switchMode('login')}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`authgate-tab-btn ${mode === 'register' ? 'active' : ''}`}
                onClick={() => switchMode('register')}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Card Header */}
          <div className="authgate-card-header">
            {mode === 'login' && (
              <>
                <h2 className="authgate-card-title">Welcome Back</h2>
                <p className="authgate-card-desc">Sign in to resume your executive workspace.</p>
              </>
            )}
            {mode === 'register' && (
              <>
                <h2 className="authgate-card-title">Get Started with TaskFlow</h2>
                <p className="authgate-card-desc">Create your private, synchronized workspace in seconds.</p>
              </>
            )}
            {mode === 'forgot' && (
              <>
                <button type="button" className="authgate-back-link" onClick={() => switchMode('login')}>
                  <ArrowLeftIcon size={14} /> Back to Sign In
                </button>
                <h2 className="authgate-card-title" style={{ marginTop: '12px' }}>Reset Password</h2>
                <p className="authgate-card-desc">Enter your account email to receive reset instructions.</p>
              </>
            )}
            {mode === 'reset' && (
              <>
                <button type="button" className="authgate-back-link" onClick={() => switchMode('login')}>
                  <ArrowLeftIcon size={14} /> Back to Sign In
                </button>
                <h2 className="authgate-card-title" style={{ marginTop: '12px' }}>Set New Password</h2>
                <p className="authgate-card-desc">Choose a strong, new password for your account.</p>
              </>
            )}
          </div>

          {/* Alerts / Feedback */}
          {errorMessage && (
            <div className="authgate-alert error">
              <AlertTriangleIcon size={18} className="authgate-alert-icon" />
              <div className="authgate-alert-text">{errorMessage}</div>
            </div>
          )}

          {infoMessage && (
            <div className="authgate-alert info">
              <InfoIcon size={18} className="authgate-alert-icon" />
              <div className="authgate-alert-text" style={{ whiteSpace: 'pre-line' }}>{infoMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="authgate-form">
            {/* Name Field (Sign Up Only) */}
            {mode === 'register' && (
              <div className="authgate-field">
                <label className="authgate-label" htmlFor="auth-name">Full Name</label>
                <div className="authgate-input-wrapper">
                  <span className="authgate-input-icon"><UserIcon size={18} /></span>
                  <input
                    id="auth-name"
                    type="text"
                    className="authgate-input"
                    placeholder="e.g. Alex Sterling"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Email Field (Sign In, Sign Up, Forgot) */}
            {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
              <div className="authgate-field">
                <label className="authgate-label" htmlFor="auth-email">Email Address</label>
                <div className="authgate-input-wrapper">
                  <span className="authgate-input-icon"><MailIcon size={18} /></span>
                  <input
                    id="auth-email"
                    type="email"
                    className="authgate-input"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus={mode !== 'register'}
                  />
                </div>
              </div>
            )}

            {/* Token Field (Reset Mode Only) */}
            {mode === 'reset' && (
              <div className="authgate-field">
                <label className="authgate-label" htmlFor="auth-token">Reset Token</label>
                <div className="authgate-input-wrapper">
                  <span className="authgate-input-icon"><LockIcon size={18} /></span>
                  <input
                    id="auth-token"
                    type="text"
                    className="authgate-input"
                    placeholder="Paste your reset token"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {/* Password Field (Sign In, Sign Up, Reset) */}
            {(mode === 'login' || mode === 'register' || mode === 'reset') && (
              <div className="authgate-field">
                <div className="authgate-label-row">
                  <label className="authgate-label" htmlFor="auth-pass">
                    {mode === 'reset' ? 'New Password' : 'Password'}
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      className="authgate-forgot-link"
                      onClick={() => switchMode('forgot')}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="authgate-input-wrapper">
                  <span className="authgate-input-icon"><LockIcon size={18} /></span>
                  <input
                    id="auth-pass"
                    type={showPassword ? 'text' : 'password'}
                    className="authgate-input has-toggle"
                    placeholder={mode === 'register' || mode === 'reset' ? 'At least 8 characters' : 'Enter your password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={mode === 'register' || mode === 'reset' ? 8 : undefined}
                  />
                  <button
                    type="button"
                    className="authgate-eye-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeClosed /> : <EyeOpen />}
                  </button>
                </div>
              </div>
            )}

            {/* Confirm Password Field (Sign Up, Reset) */}
            {(mode === 'register' || mode === 'reset') && (
              <div className="authgate-field">
                <label className="authgate-label" htmlFor="auth-confirm-pass">Confirm Password</label>
                <div className="authgate-input-wrapper">
                  <span className="authgate-input-icon"><LockIcon size={18} /></span>
                  <input
                    id="auth-confirm-pass"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="authgate-input has-toggle"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="authgate-eye-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeClosed /> : <EyeOpen />}
                  </button>
                </div>
              </div>
            )}

            {/* Password Validation Checklist for Registration */}
            {(mode === 'register' || mode === 'reset') && password.length > 0 && (
              <div className="authgate-pass-check">
                <div className={`authgate-check-item ${passHasLength ? 'valid' : ''}`}>
                  <CheckIcon size={13} /> Minimum 8 characters
                </div>
                <div className={`authgate-check-item ${passHasNumber ? 'valid' : ''}`}>
                  <CheckIcon size={13} /> Contains a number
                </div>
                {confirmPassword.length > 0 && (
                  <div className={`authgate-check-item ${passHasMatch ? 'valid' : ''}`}>
                    <CheckIcon size={13} /> Passwords match
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary authgate-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <span className="authgate-btn-loading">
                  <RefreshCwIcon size={16} className="spinning" />
                  <span>Processing...</span>
                </span>
              ) : (
                <span>
                  {mode === 'login' && 'Sign In to Workspace →'}
                  {mode === 'register' && 'Create Executive Account ✨'}
                  {mode === 'forgot' && 'Send Recovery Instructions →'}
                  {mode === 'reset' && 'Update Password & Access →'}
                </span>
              )}
            </button>
          </form>

          {/* Card Footer Info */}
          <div className="authgate-card-footer">
            <div className="authgate-security-note">
              <LockIcon size={13} />
              <span>256-Bit SSL Encrypted &amp; Secure Session</span>
            </div>
            <div className="authgate-legal-links">
              <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
              <span>•</span>
              <a href="/terms.html" target="_blank" rel="noopener noreferrer">Terms of Service</a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
