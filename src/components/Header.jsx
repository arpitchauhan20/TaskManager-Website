import React, { useState, useEffect } from 'react';
import { ZapIcon, SearchIcon, BellIcon, RefreshCwIcon, PlusIcon, XIcon } from './Icons';

export default function Header({
  searchQuery,
  onSearchChange,
  currentSort,
  onSortChange,
  onOpenMobileMenu,
  onOpenNewTask,
  onOpenSettings,
  onTestAlerts
}) {
  const [currentDateText, setCurrentDateText] = useState('');

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
