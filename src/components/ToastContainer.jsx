import React from 'react';
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  BellIcon,
  ClockIcon,
  CalendarIcon,
  MailIcon,
  SparklesIcon,
  KeyIcon,
  ShieldIcon,
  UserIcon,
  DownloadIcon,
  TrashIcon,
  InfoIcon,
  XIcon
} from './Icons';

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  const renderIcon = (icon, type) => {
    // If icon is a known keyword
    switch (icon) {
      case 'check':
      case 'success':
      case '✓':
      case '✅':
        return <CheckCircleIcon size={16} />;
      case 'alert':
      case 'warning':
      case 'error':
      case '⚠️':
      case '❌':
      case '🚨':
        return <AlertTriangleIcon size={16} />;
      case 'bell':
      case 'reminder':
      case '🔔':
        return <BellIcon size={16} />;
      case 'clock':
      case '⏰':
      case '⏳':
      case '⌛':
        return <ClockIcon size={16} />;
      case 'calendar':
      case '📅':
      case '🗓️':
        return <CalendarIcon size={16} />;
      case 'mail':
      case 'email':
      case '📧':
      case '✉️':
        return <MailIcon size={16} />;
      case 'sparkles':
      case '✨':
      case '🎉':
        return <SparklesIcon size={16} />;
      case 'key':
      case '🔑':
        return <KeyIcon size={16} />;
      case 'shield':
      case '🛡️':
        return <ShieldIcon size={16} />;
      case 'user':
      case '👤':
      case '👋':
        return <UserIcon size={16} />;
      case 'download':
      case '📥':
        return <DownloadIcon size={16} />;
      case 'trash':
      case 'delete':
      case '🗑️':
        return <TrashIcon size={16} />;
      case 'info':
      case 'ℹ️':
        return <InfoIcon size={16} />;
      default:
        // Fallback by type
        if (type === 'success') return <CheckCircleIcon size={16} />;
        if (type === 'error') return <AlertTriangleIcon size={16} />;
        if (type === 'reminder') return <BellIcon size={16} />;
        return <InfoIcon size={16} />;
    }
  };

  return (
    <div className="toast-container" id="toast-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast ${toast.type || 'info'}`}
          onClick={() => onDismiss(toast.id)}
          title="Click to dismiss"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <span className="toast-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {renderIcon(toast.icon, toast.type)}
          </span>
          <span className="toast-message" style={{ flex: 1, whiteSpace: 'pre-line' }}>
            {toast.message}
          </span>
          <button
            type="button"
            className="btn-dismiss"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(toast.id);
            }}
            title="Dismiss"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '2px 6px',
              marginLeft: '6px',
              borderRadius: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <XIcon size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
