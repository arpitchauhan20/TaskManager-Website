import React, { useState, useEffect, useRef } from 'react';
import { ZapIcon, SearchIcon, BellIcon, RefreshCwIcon, PlusIcon, XIcon, LinkIcon, KeyIcon, MailIcon, LogOutIcon } from './Icons';

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
      {/* Mobile Menu & Date Context */}
      <div className="topbar-context">
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

        <span className="date-badge">{currentDateText}</span>
      </div>

      {/* Flexible Topbar Actions */}
      <div className="topbar-actions">
        {/* Search */}
        <div className="topbar-search">
          <span className="search-icon"><SearchIcon size={14} /></span>
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
              <XIcon size={12} />
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
            <option value="deadline-asc">Timeline: Soonest first</option>
            <option value="deadline-desc">Timeline: Latest first</option>
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
          <ZapIcon size={16} />
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
          <BellIcon size={16} />
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
          <RefreshCwIcon size={14} />
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
                    onOpenSettings();
                  }}
                  id="profile-connect-accounts-btn"
                >
                  <LinkIcon size={16} />
                  <span>Connect Accounts &amp; Integrations</span>
                </button>

                <button
                  type="button"
                  className="profile-dropdown-item"
                  onClick={() => {
                    setIsProfileOpen(false);
                    onOpenAuthModal('change-password');
                  }}
                  id="profile-change-password-btn"
                >
                  <KeyIcon size={16} />
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
                  <MailIcon size={16} />
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
                  <LogOutIcon size={16} />
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
          <PlusIcon size={13} style={{ marginRight: '4px' }} />
          <span>Add Task</span>
        </button>
      </div>
    </header>
  );
}
