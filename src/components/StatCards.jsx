import React from 'react';

export default function StatCards({ userName, stats, currentFilter, onSelectFilter }) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <section className="canvas-hero">
      {/* Greeting Block */}
      <div className="greeting-block">
        <h1 className="greeting-text">
          {getGreeting()},{' '}
          <span className="greeting-name">{userName || 'Executive'}</span>{' '}
          <span className="wave">👋</span>
        </h1>
        <p className="greeting-subtitle">
          You have {stats.today} tasks due today and {stats.high} high priority deadlines.
        </p>
      </div>

      {/* Metrics Strip */}
      <div className="metrics-strip">
        <div
          className="metric-item"
          onClick={() => onSelectFilter('all')}
          title="Show All Tasks"
          style={{ cursor: 'pointer' }}
        >
          <span className="metric-val">{stats.total}</span>
          <span className="metric-lbl">Total</span>
        </div>

        <div className="metric-divider" />

        <div
          className="metric-item"
          onClick={() => onSelectFilter('today')}
          title="Show Today's Tasks"
          style={{ cursor: 'pointer' }}
        >
          <span className="metric-val">{stats.today}</span>
          <span className="metric-lbl">Today</span>
        </div>

        <div className="metric-divider" />

        <div
          className="metric-item"
          onClick={() => onSelectFilter('high')}
          title="Show High Priority Tasks"
          style={{ cursor: 'pointer' }}
        >
          <span className="metric-val danger">{stats.high}</span>
          <span className="metric-lbl">High</span>
        </div>

        <div className="metric-divider" />

        <div
          className="metric-item"
          onClick={() => onSelectFilter('completed')}
          title="Show Completed Tasks"
          style={{ cursor: 'pointer' }}
        >
          <span className="metric-val">{stats.completed}</span>
          <span className="metric-lbl">Done</span>
        </div>
      </div>
    </section>
  );
}
