// ==========================================================================
// TaskFlow Pro — Unified Vercel Serverless Entrypoint (Single Function)
// Combines Auth, Google Calendar, Resend Email, and Reminder Endpoints
// into 1 Serverless Function to stay well within Vercel's Hobby 12-function limit.
// ==========================================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('../routes/authRoutes');
const calendarRoutes = require('../routes/calendarRoutes');
const sendEmailHandler = require('../services/sendEmailHandler');
const calendarFeedHandler = require('../services/calendarFeedHandler');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Normalization middleware for Vercel rewrites:
// Handles both rewritten path (/api) and original URL (/api/auth/register)
app.use((req, res, next) => {
  const matched = req.headers['x-matched-path'];
  if (matched && (req.url === '/' || req.url === '/api' || req.url === '/api/' || req.url.startsWith('/api/index'))) {
    req.url = matched;
  }
  next();
});

// Mount Authentication System Endpoints (supports both /api/auth and /auth)
app.use(['/api/auth', '/auth'], authRoutes);

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
  console.error('[Vercel Serverless Error]', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

module.exports = (req, res) => {
  return app(req, res);
};
