import React from 'react';
import { SparklesIcon } from './Icons';

export function TaskMetricsStrip({ stats, currentFilter, onSelectFilter }) {
  return (
    <div className="metrics-strip">
      <div
        className={`metric-item ${currentFilter === 'all' ? 'active-metric' : ''}`}
        onClick={() => onSelectFilter && onSelectFilter('all')}
        title="Filter by Dashboard (All Tasks)"
        style={{ cursor: 'pointer' }}
      >
        <span className="metric-val">{stats.total}</span>
        <span className="metric-lbl">Total</span>
      </div>

      <div className="metric-divider" />

      <div
        className={`metric-item ${currentFilter === 'today' ? 'active-metric' : ''}`}
        onClick={() => onSelectFilter && onSelectFilter('today')}
        title="Filter by Due Today"
        style={{ cursor: 'pointer' }}
      >
        <span className="metric-val">{stats.today}</span>
        <span className="metric-lbl">Today</span>
      </div>

      <div className="metric-divider" />

      <div
        className={`metric-item ${currentFilter === 'high' ? 'active-metric' : ''}`}
        onClick={() => onSelectFilter && onSelectFilter('high')}
        title="Filter by High Priority"
        style={{ cursor: 'pointer' }}
      >
        <span className="metric-val danger">{stats.high}</span>
        <span className="metric-lbl">High</span>
      </div>

      <div className="metric-divider" />

      <div
        className={`metric-item ${currentFilter === 'completed' ? 'active-metric' : ''}`}
        onClick={() => onSelectFilter && onSelectFilter('completed')}
        title="Filter by Completed"
        style={{ cursor: 'pointer' }}
      >
        <span className="metric-val">{stats.completed}</span>
        <span className="metric-lbl">Done</span>
      </div>
    </div>
  );
}

export function GreetingHero({ userName, stats }) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <section className="canvas-hero">
      <div className="greeting-block">
        <h1 className="greeting-text">
          {getGreeting()},{' '}
          <span className="greeting-name">{userName || 'Executive'}</span>
          <SparklesIcon size={26} className="sparkle-greet" style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '8px', color: 'var(--accent-light, #818cf8)' }} />
        </h1>
        <p className="greeting-subtitle">
          You have <strong style={{ color: 'var(--text-primary, #ffffff)' }}>{stats?.today || 0}</strong> tasks due today and <strong style={{ color: stats?.high > 0 ? 'var(--danger, #f43f5e)' : 'var(--text-primary, #ffffff)' }}>{stats?.high || 0}</strong> high priority deadlines.
        </p>
      </div>
    </section>
  );
}

export default function StatCards(props) {
  const { variant = 'both', stats, userName, currentFilter, onSelectFilter } = props;

  if (variant === 'metrics') {
    return <TaskMetricsStrip stats={stats} currentFilter={currentFilter} onSelectFilter={onSelectFilter} />;
  }

  if (variant === 'greeting') {
    return <GreetingHero userName={userName} stats={stats} />;
  }

  return (
    <section className="canvas-hero">
      <GreetingHero userName={userName} stats={stats} />
      <TaskMetricsStrip stats={stats} currentFilter={currentFilter} onSelectFilter={onSelectFilter} />
    </section>
  );
}

