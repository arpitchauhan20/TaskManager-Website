const jwt = require('jsonwebtoken');
const userStorage = require('../services/storage/userStorage');

const JWT_SECRET = process.env.JWT_SECRET || 'taskflow-pro-jwt-secret-key-2026-prod';

async function authMiddleware(req, res, next) {
  let token = null;

  // 1. Check cookies (preferred for browser sessions)
  if (req.cookies && req.cookies.auth_token) {
    token = req.cookies.auth_token;
  }

  // 2. Check Authorization header fallback: Bearer <token>
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please sign in.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await userStorage.findById(decoded.id);

    if (!user) {
      res.clearCookie('auth_token', { httpOnly: true, sameSite: 'lax' });
      return res.status(401).json({
        success: false,
        error: 'Session expired or user not found. Please sign in again.'
      });
    }

    // Attach safe user object (exclude sensitive fields)
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      google_calendar_connected: user.google_calendar_connected
    };

    next();
  } catch (err) {
    res.clearCookie('auth_token', { httpOnly: true, sameSite: 'lax' });
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication session.'
    });
  }
}

module.exports = {
  authMiddleware,
  JWT_SECRET
};
