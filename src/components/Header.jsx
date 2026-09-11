import React, { useState, useEffect, useRef } from 'react';

export default function Header({
  currentFilter,
  searchQuery,
  onSearchChange,
  currentSort,
  onSortChange,
  onOpenMobileMenu,
  onOpenNewTask,
  onOpenSettings,
  onTestAlerts,
  currentUser,
  onOpenAuthModal,
  onLogout
}) {
  const [currentDateText, setCurrentDateText] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options = { weekday: 'short', month: 'short', day: 'numeric' };
      setCurrentDateText(now.toLocaleDateString('en-US', options));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setIsProfileOpen(false);
      }
    };
    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isProfileOpen]);

  const filterTitles = {
    all: 'All Tasks',
    today: 'Due Today',
    upcoming: 'Upcoming Deadlines',
    high: 'High Priority Tasks',
    overdue: 'Overdue Tasks',
    completed: 'Completed Tasks'
  };

  // Generate initials for the avatar
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  // Generate a consistent color based on user name
  const getAvatarColor = (name) => {
    if (!name) return 'linear-gradient(135deg, #6366f1, #4f46e5)';
    const colors = [
      'linear-gradient(135deg, #6366f1, #4f46e5)',
      'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      'linear-gradient(135deg, #06b6d4, #0891b2)',
      'linear-gradient(135deg, #10b981, #059669)',
      'linear-gradient(135deg, #f59e0b, #d97706)',
      'linear-gradient(135deg, #ec4899, #db2777)',
      'linear-gradient(135deg, #3b82f6, #2563eb)'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <header className="main-topbar">
      {/* Mobile Menu & Title */}
      <button
        type="button"
        className="mobile-menu-btn"
        onClick={onOpenMobileMenu}
        title="Open Navigation Menu"
        aria-label="Open Navigation Menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <div className="topbar-context">
        <span className="view-title">{filterTitles[currentFilter] || 'All Tasks'}</span>
        <span className="date-badge">{currentDateText}</span>
      </div>

      {/* Topbar Actions */}
      <div className="topbar-actions">
        {/* Search */}
        <div className="topbar-search">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear"
              onClick={() => onSearchChange('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Sort */}
        <div className="sort-wrapper">
          <select
            className="sort-select"
            value={currentSort}
            onChange={e => onSortChange(e.target.value)}
          >
            <option value="deadline-asc">Deadline: Soonest first</option>
            <option value="deadline-desc">Deadline: Latest first</option>
            <option value="priority-desc">Priority: High to Low</option>
            <option value="created-desc">Recently Created</option>
            <option value="title-asc">Alphabetical (A-Z)</option>
          </select>
        </div>

        {/* Automation Settings Icon */}
        <button
          type="button"
          className="control-btn notif-btn active"
          onClick={onOpenSettings}
          title="Open Resend & Google Calendar Automation Settings"
        >
          <span>⚡</span>
          <span className="status-dot" />
        </button>

        {/* Instant Alert & Audio Bell Test */}
        <button
          type="button"
          className="control-btn notif-btn"
          onClick={onTestAlerts}
          title="Test Audio Bell Chime & System Alert Notification (Click to Test)"
          style={{ position: 'relative' }}
        >
          <span>🔔</span>
        </button>

        {/* Instant Refresh Button */}
        <button
          type="button"
          className="control-btn refresh-btn"
          onClick={() => {
            if ('caches' in window) {
              caches.keys().then(names => {
                names.forEach(name => caches.delete(name));
              });
            }
            window.location.reload();
          }}
          title="Refresh Application (Hard Reload)"
          aria-label="Refresh Application"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
        </button>

        {/* User Account / Auth Actions */}
        {currentUser ? (
          <div className="profile-dropdown-wrapper" ref={profileRef}>
            {/* Profile Avatar Button */}
            <button
              type="button"
              className="profile-avatar-btn"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              title={`Signed in as ${currentUser.email}`}
              aria-label="Open profile menu"
              id="profile-avatar-btn"
            >
              <div
                className="profile-avatar-circle"
                style={{ background: getAvatarColor(currentUser.name) }}
              >
                {getInitials(currentUser.name)}
              </div>
            </button>

            {/* Profile Dropdown */}
            {isProfileOpen && (
              <div className="profile-dropdown" id="profile-dropdown-menu">
                {/* User Info Section */}
                <div className="profile-dropdown-header">
                  <div
                    className="profile-dropdown-avatar"
                    style={{ background: getAvatarColor(currentUser.name) }}
                  >
                    {getInitials(currentUser.name)}
                  </div>
                  <div className="profile-dropdown-info">
                    <span className="profile-dropdown-name">{currentUser.name}</span>
                    <span className="profile-dropdown-email">{currentUser.email}</span>
                  </div>
                </div>

                <div className="profile-dropdown-divider" />

                {/* Menu Items */}
                <button
                  type="button"
                  className="profile-dropdown-item"
                  onClick={() => {
                    setIsProfileOpen(false);
                    onOpenAuthModal('change-password');
                  }}
                  id="profile-change-password-btn"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>Change Password</span>
                </button>

                <button
                  type="button"
                  className="profile-dropdown-item"
                  onClick={() => {
                    setIsProfileOpen(false);
                    onOpenAuthModal('forgot');
                  }}
                  id="profile-reset-password-btn"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <span>Reset Password via Email</span>
                </button>

                <div className="profile-dropdown-divider" />

                <button
                  type="button"
                  className="profile-dropdown-item profile-dropdown-item--danger"
                  onClick={() => {
                    setIsProfileOpen(false);
                    onLogout();
                  }}
                  id="profile-logout-btn"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Log Out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onOpenAuthModal('login')}
            title="Sign in or create account"
            id="sign-in-btn"
          >
            <span>Sign In</span>
          </button>
        )}

        {/* Add Task Button */}
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onOpenNewTask}
          title="Add New Task (Shortcut: N)"
        >
          <span>+ Add Task</span>
        </button>
      </div>
    </header>
  );
}
