import React, { useState } from 'react';
import TaskRow from './TaskRow';

export default function TaskList({
  tasks,
  onToggleComplete,
  onEdit,
  onDelete,
  onSyncGoogleCalendar,
  onDownloadICS,
  onSendEmail,
  onOpenNewTask,
  currentFilter
}) {
  const [isOpen, setIsOpen] = useState(true);

  const filterNames = {
    all: 'All Tasks',
    today: 'Due Today',
    upcoming: 'Upcoming',
    high: 'High Priority',
    overdue: 'Overdue',
    completed: 'Completed'
  };

  const pendingCount = tasks.filter(t => !t.completed).length;
  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <section className={`tasks-container dashboard-mini-card ${isOpen ? 'expanded' : 'collapsed'}`}>
      {/* Task Details Card Header Bar (Always Clickable) */}
      <div
        className="mini-card-header"
        onClick={() => setIsOpen(prev => !prev)}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        title={isOpen ? 'Click to collapse task details' : 'Click to open task details'}
      >
        <div className="mini-card-lead">
          <div className="mini-card-icon-wrap task">
            <span className="mini-card-emoji">📋</span>
          </div>
          <div className="mini-card-info">
            <div className="mini-card-title-row">
              <h3 className="mini-card-title">Task Details &amp; Workspace</h3>
              <span className="mini-card-badge filter-badge">
                {filterNames[currentFilter] || 'All Tasks'} ({tasks.length})
              </span>
              {pendingCount > 0 && (
                <span className="mini-card-badge count-badge">
                  {pendingCount} Active
                </span>
              )}
            </div>
            <p className="mini-card-subtitle">
              {isOpen
                ? 'Manage active tasks, deadlines, priorities & automated reminders'
                : `${tasks.length} task${tasks.length === 1 ? '' : 's'} in view • Click to expand and manage details`}
            </p>
          </div>
        </div>

        <div className="mini-card-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onOpenNewTask();
            }}
            title="Create a new task"
          >
            <span>+ Add Task</span>
          </button>
          <button
            type="button"
            className="mini-card-toggle-btn"
            aria-label={isOpen ? 'Collapse' : 'Expand'}
          >
            <span>{isOpen ? 'Collapse ▴' : 'Open ▾'}</span>
          </button>
        </div>
      </div>

      {/* Expanded Content Area */}
      {isOpen && (
        <div className="mini-card-body">
          {tasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon-wrap">
                <span className="empty-icon">🎯</span>
              </div>
              <h3 className="empty-title">
                {currentFilter === 'completed'
                  ? 'No completed tasks yet'
                  : currentFilter === 'overdue'
                  ? 'No overdue tasks! You are on top of everything.'
                  : 'Clear horizon — no tasks found'}
              </h3>
              <p className="empty-subtitle">
                {currentFilter === 'all'
                  ? 'All clear! Create a new task or check the Completed tab.'
                  : 'Try changing your filter or add a new task.'}
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onOpenNewTask}
                style={{ marginTop: '14px' }}
              >
                + Create New Task
              </button>
            </div>
          ) : (
            <>
              <div className="tasks-table-header">
                <span className="col-status">Status</span>
                <span className="col-task">Task Details</span>
                <span className="col-deadline">Deadline &amp; Urgency</span>
                <span className="col-priority">Priority</span>
                <span className="col-reminder">Reminder</span>
                <span className="col-actions">Actions</span>
              </div>

              <div className="task-list" id="task-list">
                {tasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggleComplete={onToggleComplete}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onSyncGoogleCalendar={onSyncGoogleCalendar}
                    onDownloadICS={onDownloadICS}
                    onSendEmail={onSendEmail}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
