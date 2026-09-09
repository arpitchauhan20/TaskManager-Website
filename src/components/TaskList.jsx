import React from 'react';
import TaskRow from './TaskRow';

export default function TaskList({
  tasks,
  onToggleComplete,
  onEdit,
  onDelete,
  onShareWhatsApp,
  onSyncGoogleCalendar,
  onDownloadICS,
  onSendEmail,
  onOpenNewTask,
  currentFilter
}) {
  if (tasks.length === 0) {
    return (
      <section className="tasks-container">
        <div className="tasks-table-header">
          <span className="col-status">Status</span>
          <span className="col-task">Task Details</span>
          <span className="col-deadline">Deadline &amp; Urgency</span>
          <span className="col-priority">Priority</span>
          <span className="col-reminder">Reminder</span>
          <span className="col-actions">Actions</span>
        </div>

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
              ? 'Create your first task to start organizing deadlines and automated alerts.'
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
      </section>
    );
  }

  return (
    <section className="tasks-container">
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
            onShareWhatsApp={onShareWhatsApp}
            onSyncGoogleCalendar={onSyncGoogleCalendar}
            onDownloadICS={onDownloadICS}
            onSendEmail={onSendEmail}
          />
        ))}
      </div>
    </section>
  );
}
