// ==========================================================================
// TaskFlow Pro — Unified Vercel Serverless Entrypoint (Single Function)
// With Top-Level Error Capture to Expose Cold-Start / Import Crashes
// ==========================================================================

let initError = null;
let app = null;

try {
  require('dotenv').config();
  const express = require('express');
  const cors = require('cors');
  const cookieParser = require('cookie-parser');
  const authRoutes = require('../routes/authRoutes');
  const calendarRoutes = require('../routes/calendarRoutes');
  const taskRoutes = require('../routes/taskRoutes');
  const sendEmailHandler = require('../services/sendEmailHandler');
  const calendarFeedHandler = require('../services/calendarFeedHandler');

  app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  // Normalization middleware for Vercel rewrites:
  app.use((req, res, next) => {
    const matched = req.headers['x-matched-path'];
    if (matched && (req.url === '/' || req.url === '/api' || req.url === '/api/' || req.url.startsWith('/api/index'))) {
      req.url = matched;
    }
    next();
  });

  // Health check endpoint
  app.get(['/api/health', '/health'], (req, res) => {
    res.status(200).json({ status: 'ok', time: new Date().toISOString() });
  });

  // Mount Authentication System Endpoints
  app.use(['/api/auth', '/auth'], authRoutes);

  // Mount Authenticated Tasks REST API
  app.use(['/api/tasks', '/tasks'], taskRoutes);

  // Mount Google Calendar OAuth & API Endpoints
  app.use(['/api/calendar', '/calendar'], calendarRoutes);
  app.use('/', calendarRoutes);

  // Mount Resend HTTPS API endpoints
  app.post(['/api/send-email', '/send-email'], sendEmailHandler);
  app.post(['/api/test-email', '/test-email'], sendEmailHandler);

  // Live Calendar ICS feed
  app.get(['/api/calendar', '/calendar'], calendarFeedHandler);

  // Web Push / Reminders fallbacks
  app.get(['/api/vapid-public-key', '/vapid-public-key'], (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
  });

  app.post(['/api/subscribe', '/subscribe'], (req, res) => {
    res.status(201).json({ success: true, count: 1 });
  });

  app.post(['/api/schedule-reminder', '/schedule-reminder'], (req, res) => {
    const { taskId, title, deadline, reminderTime, priority, channels, email } = req.body || {};
    res.status(200).json({
      success: true,
      reminder: {
        id: 'rem_' + Date.now(),
        taskId,
        title,
        deadline,
        reminderTime,
        priority,
        channels,
        email,
        createdAt: new Date().toISOString()
      }
    });
  });

  app.delete(['/api/cancel-reminder', '/cancel-reminder'], (req, res) => {
    res.status(200).json({ success: true });
  });

  // Fallback error handler
  app.use((err, req, res, next) => {
    console.error('[API Handler Error]', err);
    if (res.headersSent) return next(err);
    res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });
  });

} catch (err) {
  console.error('[Fatal Vercel Init Error]', err);
  initError = {
    name: err.name,
    message: err.message,
    stack: err.stack
  };
}

module.exports = (req, res) => {
  if (initError) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).end(JSON.stringify({
      success: false,
      error: 'Vercel Serverless Initialization Error',
      details: initError
    }, null, 2));
  }

  try {
    return app(req, res);
  } catch (runtimeErr) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).end(JSON.stringify({
      success: false,
      error: 'Vercel Invocation Runtime Error',
      details: {
        name: runtimeErr.name,
        message: runtimeErr.message,
        stack: runtimeErr.stack
      }
    }, null, 2));
  }
};
