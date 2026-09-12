import React, { useEffect } from 'react';

export default function Sidebar({
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
  currentFilter,
  onSelectFilter,
  taskCounts,
  currentPalette,
  onChangePalette,
  soundEnabled,
  onToggleSound,
  userName,
  onOpenSettings,
  onOpenNewTask,
  currentUser,
  onOpenAuthModal,
  onLogout
}) {
  const filters = [
    { id: 'all', label: 'All Tasks', icon: '📋', count: taskCounts.all },
    { id: 'today', label: 'Due Today', icon: '☀️', count: taskCounts.today },
    { id: 'upcoming', label: 'Upcoming', icon: '🗓️', count: taskCounts.upcoming },
    { id: 'high', label: 'High Priority', icon: '🔥', count: taskCounts.high },
    { id: 'overdue', label: 'Overdue', icon: '⚠️', count: taskCounts.overdue, isOverdue: true },
    { id: 'completed', label: 'Completed', icon: '✅', count: taskCounts.completed }
  ];

  // Close sidebar on Escape and lock body scroll on mobile/tablet when open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  return (
    <>
      <aside className={`app-sidebar ${isCollapsed ? 'collapsed' : ''} ${isOpen ? 'open' : ''}`} id="app-sidebar">
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="brand-logo-wrap">
            <div className="brand-icon">⚡</div>
            <div className="brand-text">
              <div className="brand-name">
                TaskFlow <span>PRO</span>
              </div>
              <div className="brand-workspace">Executive Suite</div>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onClose}
            title="Close Menu"
            aria-label="Close navigation menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Navigation Workspaces */}
        <nav className="sidebar-nav">
          <div className="nav-section-title">WORKSPACES</div>
          {filters.map(item => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${currentFilter === item.id ? 'active' : ''}`}
              onClick={() => {
                onSelectFilter(item.id);
                onClose();
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              <span className={`nav-badge ${item.isOverdue && item.count > 0 ? 'danger' : ''}`}>
                {item.count}
              </span>
            </button>
          ))}
        </nav>

        {/* Spacer */}
        <div style={{ flex: 1, minHeight: '16px' }} />

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          {/* User Profile Card / Auth Action */}
          {!currentUser ? (
            <div className="sidebar-auth-prompt">
              <button
                type="button"
                className="btn btn-primary btn-sm sidebar-auth-btn"
                onClick={() => {
                  onOpenAuthModal('login');
                  onClose();
                }}
              >
                <span>🔑 Sign In / Register</span>
              </button>
            </div>
          ) : (
            <div
              className="sidebar-user-card"
              onClick={() => {
                onOpenSettings();
                onClose();
              }}
              title={`Signed in as ${currentUser.email}. Click to connect accounts & manage settings.`}
            >
              <div className="user-avatar">
                {(currentUser.name || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="user-details">
                <span className="user-name-display">{currentUser.name}</span>
                <span className="user-edit-hint">{currentUser.email}</span>
              </div>
              <div className="user-card-action" title="Settings & Integrations">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </div>
            </div>
          )}

          {/* Bottom Controls Bar: Theme Swatches + Utility Tools */}
          <div className="sidebar-bottom-controls">
            <div className="palette-picker-wrap">
              <span className="palette-label">Theme</span>
              <div className="palette-picker">
                {[
                  { id: 'indigo', title: 'Obsidian Indigo', cls: 'theme-indigo' },
                  { id: 'emerald', title: 'Emerald Forest', cls: 'theme-emerald' },
                  { id: 'cyan', title: 'Midnight Cyan', cls: 'theme-cyan' },
                  { id: 'light', title: 'Studio Light', cls: 'theme-light' }
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className={`palette-btn ${p.cls} ${currentPalette === p.id ? 'active' : ''}`}
                    onClick={() => onChangePalette(p.id)}
                    title={p.title}
                  />
                ))}
              </div>
            </div>

            <div className="sidebar-utility-tools">
              <button
                type="button"
                className={`tool-icon-btn ${soundEnabled ? 'active' : ''}`}
                onClick={onToggleSound}
                title={soundEnabled ? 'Mute Sound FX' : 'Enable 10s Bell Chime'}
                aria-label="Toggle Sound"
              >
                {soundEnabled ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                )}
              </button>

              {currentUser && (
                <button
                  type="button"
                  className="tool-icon-btn logout-btn"
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              )}

              <button
                type="button"
                className="tool-icon-btn collapse-btn"
                onClick={onToggleCollapse}
                title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                aria-label="Toggle Sidebar Collapse"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points={isCollapsed ? "9 18 15 12 9 6" : "15 18 9 12 15 6"} />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile / Tablet Backdrop */}
      <div
        className={`sidebar-backdrop ${isOpen ? 'active' : ''}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />
    </>
  );
}
