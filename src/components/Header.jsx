import React, { useState, useEffect } from 'react';

export default function Header({
  currentFilter,
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

  const filterTitles = {
    all: 'All Tasks',
    today: 'Due Today',
    upcoming: 'Upcoming Deadlines',
    high: 'High Priority Tasks',
    overdue: 'Overdue Tasks',
    completed: 'Completed Tasks'
  };

  return (
    <header className="main-topbar">
      {/* Mobile Menu & Title */}
      <button
        type="button"
        className="mobile-menu-btn"
        onClick={onOpenMobileMenu}
        title="Open Menu"
      >
        ☰
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
