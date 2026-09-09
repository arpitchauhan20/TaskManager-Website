import React from 'react';

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
  onOpenNewTask
}) {
  const filters = [
    { id: 'all', label: 'All Tasks', icon: '📋', count: taskCounts.all },
    { id: 'today', label: 'Due Today', icon: '☀️', count: taskCounts.today },
    { id: 'upcoming', label: 'Upcoming', icon: '🗓️', count: taskCounts.upcoming },
    { id: 'high', label: 'High Priority', icon: '🔥', count: taskCounts.high },
    { id: 'overdue', label: 'Overdue', icon: '⚠️', count: taskCounts.overdue, isOverdue: true },
    { id: 'completed', label: 'Completed', icon: '✅', count: taskCounts.completed }
  ];

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
          <button type="button" className="sidebar-close-btn" onClick={onClose} title="Close Menu">
            ✕
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
        <div style={{ flex: 1 }} />

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          {/* User Profile */}
          <div className="footer-user-row">
            <div className="user-pill" onClick={onOpenSettings} title="Click to open Settings & Automation">
              <div className="user-avatar">
                {(userName || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="user-details">
                <span className="user-name-display">{userName || 'Executive'}</span>
                <span className="user-edit-hint">⚡ Resend &amp; Calendar Settings</span>
              </div>
            </div>

            <div className="footer-quick-tools">
              <button
                type="button"
                className="tool-icon-btn"
                onClick={onToggleSound}
                title={soundEnabled ? 'Mute Sound FX' : 'Enable 5.5s Bell Chime'}
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

      {/* Mobile Backdrop */}
      {isOpen && <div className="sidebar-backdrop active" onClick={onClose} />}
    </>
  );
}
