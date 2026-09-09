import React from 'react';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="confirm-overlay active" id="confirm-overlay" onClick={e => e.target.id === 'confirm-overlay' && onCancel()}>
      <div className="confirm-dialog">
        <div className="confirm-icon">🗑️</div>
        <h3>{title || 'Delete Task?'}</h3>
        <p>{message || 'Are you sure you want to delete this task? This action cannot be undone.'}</p>
        <div className="confirm-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger-solid" onClick={onConfirm}>
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
  );
}
