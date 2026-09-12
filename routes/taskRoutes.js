// ==========================================
// TaskFlow Pro — Authenticated Task Management REST API
// Stores tasks securely in Google Sheets (or local fallback) per User ID
// ==========================================
const express = require('express');
const taskStorage = require('../services/storage/taskStorage');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// All task routes require authentication
router.use(authMiddleware);

// -------------------------------------------------------------
// 1. GET ALL TASKS
// GET /api/tasks
// -------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const tasks = await taskStorage.getTasksByUserId(req.user.id);
    return res.status(200).json({
      success: true,
      tasks: tasks || []
    });
  } catch (err) {
    console.error('[TaskRoutes] Error fetching tasks:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tasks from server.'
    });
  }
});

// -------------------------------------------------------------
// 2. GET SINGLE TASK
// GET /api/tasks/:id
// -------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const task = await taskStorage.getTaskById(req.user.id, id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found.' });
    }
    return res.status(200).json({ success: true, task });
  } catch (err) {
    console.error('[TaskRoutes] Error fetching single task:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch task.' });
  }
});

// -------------------------------------------------------------
// 3. CREATE TASK
// POST /api/tasks
// -------------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const { title, description, deadline, priority, category, completed, tags, reminder_time, reminder_channel, sort_order, id } = req.body || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Task title is required.' });
    }

    const newTask = await taskStorage.createTask(req.user.id, {
      id,
      title: title.trim(),
      description: description ? description.trim() : '',
      deadline: deadline || '',
      priority: priority || 'medium',
      category: category || 'work',
      completed: Boolean(completed),
      tags: Array.isArray(tags) ? tags : [],
      reminder_time: reminder_time || '',
      reminder_channel: reminder_channel || '',
      sort_order: sort_order !== undefined ? sort_order : 0
    });

    return res.status(201).json({
      success: true,
      task: newTask
    });
  } catch (err) {
    console.error('[TaskRoutes] Error creating task:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to create task.'
    });
  }
});

// -------------------------------------------------------------
// 4. UPDATE TASK
// PUT /api/tasks/:id
// -------------------------------------------------------------
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    const updatedTask = await taskStorage.updateTask(req.user.id, id, updates);
    if (!updatedTask) {
      return res.status(404).json({ success: false, error: 'Task not found or not owned by user.' });
    }

    return res.status(200).json({
      success: true,
      task: updatedTask
    });
  } catch (err) {
    console.error('[TaskRoutes] Error updating task:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to update task.'
    });
  }
});

// -------------------------------------------------------------
// 5. DELETE TASK
// DELETE /api/tasks/:id
// -------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await taskStorage.deleteTask(req.user.id, id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Task not found or already deleted.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Task deleted successfully.'
    });
  } catch (err) {
    console.error('[TaskRoutes] Error deleting task:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete task.'
    });
  }
});

// -------------------------------------------------------------
// 6. BULK SYNC TASKS
// POST /api/tasks/sync
// -------------------------------------------------------------
router.post('/sync', async (req, res) => {
  try {
    const { tasks: clientTasks } = req.body || {};
    if (!Array.isArray(clientTasks)) {
      return res.status(400).json({ success: false, error: 'tasks array is required for sync.' });
    }

    const syncedTasks = await taskStorage.syncTasks(req.user.id, clientTasks);
    return res.status(200).json({
      success: true,
      tasks: syncedTasks
    });
  } catch (err) {
    console.error('[TaskRoutes] Error syncing tasks:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to sync tasks.'
    });
  }
});

module.exports = router;
