import React from 'react';

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container" id="toast-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast ${toast.type || 'info'}`}
          onClick={() => onDismiss(toast.id)}
          title="Click to dismiss"
          style={{ cursor: 'pointer' }}
        >
          <span className="toast-icon">{toast.icon || 'ℹ️'}</span>
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
              fontSize: '13px',
              padding: '2px 6px',
              marginLeft: '6px',
              borderRadius: '4px'
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
