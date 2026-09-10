import React from 'react';

export default function CalendarConnectionCard({
  isConnected,
  isLoading,
  currentUser,
  onConnect,
  onDisconnect,
  onOpenAuthModal
}) {
  const handleConnectClick = () => {
    if (!currentUser) {
      if (onOpenAuthModal) {
        onOpenAuthModal('login');
      }
      return;
    }
    if (onConnect) {
      onConnect();
    }
  };

  return (
    <div className="calendar-connection-card">
      <div className="calendar-card-header">
        <div className="calendar-card-icon-title">
          <div className="calendar-icon-wrapper">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <div className="calendar-card-text">
            <h3 className="calendar-title">Google Calendar</h3>
            <p className={`calendar-status ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '✓ Connected' : "Google Calendar isn't connected."}
            </p>
          </div>
        </div>

        <div className="calendar-card-action">
          {isConnected ? (
            <button
              type="button"
              className="btn btn-disconnect"
              onClick={onDisconnect}
              disabled={isLoading}
              title="Disconnect Google Calendar"
            >
              {isLoading ? 'Disconnecting...' : 'Disconnect'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-connect-google"
              onClick={handleConnectClick}
              disabled={isLoading}
              title={currentUser ? "Connect to your Google Calendar" : "Sign in to connect Google Calendar"}
            >
              {isLoading ? 'Connecting...' : 'Connect Google Calendar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
