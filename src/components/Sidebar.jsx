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
        <div style={{ flex: 1, minHeight: '12px' }} />

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          {/* User Profile / Auth */}
          {!currentUser ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ width: '100%', marginBottom: '10px' }}
              onClick={() => {
                onOpenAuthModal('login');
                onClose();
              }}
            >
              <span>🔑 Sign In / Register</span>
            </button>
          ) : null}

          <div className="footer-user-row">
            <div
              className="user-pill"
              onClick={() => {
                if (currentUser) {
                  onOpenAuthModal('change-password');
                } else {
                  onOpenSettings();
                }
                onClose();
              }}
              title={currentUser ? `Signed in as ${currentUser.email}. Click to manage password.` : "Click to open Settings & Automation"}
            >
              <div className="user-avatar">
                {((currentUser ? currentUser.name : userName) || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="user-details">
                <span className="user-name-display">{currentUser ? currentUser.name : (userName || 'Executive')}</span>
                <span className="user-edit-hint">{currentUser ? currentUser.email : '⚡ Resend & Calendar Settings'}</span>
              </div>
            </div>

            <div className="footer-quick-tools">
              {currentUser && (
                <button
                  type="button"
                  className="tool-icon-btn"
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  🚪
                </button>
              )}
              <button
                type="button"
                className="tool-icon-btn"
                onClick={onToggleSound}
                title={soundEnabled ? 'Mute Sound FX' : 'Enable 10s Bell Chime'}
              >
                {soundEnabled ? '🔊' : '🔇'}
              </button>
            </div>
          </div>

          {/* Theme Palette Swatches */}
          <div className="palette-picker-row">
            <span>Theme</span>
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

          {/* Collapse Toggle */}
          <div className="sidebar-collapse-wrap">
            <button
              type="button"
              className="sidebar-collapse-btn"
              onClick={onToggleCollapse}
              title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
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
