const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userStorage = require('../services/storage/userStorage');
const emailService = require('../services/email.service');
const { authMiddleware, JWT_SECRET } = require('../middleware/authMiddleware');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

// Helper: Generate JWT session token
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Helper: Set secure HTTP-only cookie
function setAuthCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

// Password complexity validator
function validatePassword(password) {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8) return false;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumberOrSymbol = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  return hasLetter && hasNumberOrSymbol;
}

// Email validator
function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

// -------------------------------------------------------------
// 1. REGISTER
// -------------------------------------------------------------
router.post('/register', rateLimiter({ max: 10, message: 'Too many registration attempts. Please try again later.' }), async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required.' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, error: 'A valid email address is required.' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters and contain both letters and numbers/symbols.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check duplicate email
    const existing = await userStorage.findByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists.'
      });
    }

    // Hash password with bcrypt
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const userId = 'usr_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    const newUser = await userStorage.createUser({
      id: userId,
      name: name.trim(),
      email: normalizedEmail,
      password_hash
    });

    const token = generateToken(newUser);
    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email
      },
      token
    });
  } catch (err) {
    console.error('[Auth API] Register error:', err);
    return res.status(500).json({ success: false, error: 'Registration failed due to a server error.' });
  }
});

// -------------------------------------------------------------
// 2. LOGIN
// -------------------------------------------------------------
router.post('/login', rateLimiter({ max: 15, message: 'Too many login attempts. Please try again in a few minutes.' }), async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await userStorage.findByEmail(normalizedEmail);

    // Generic error for invalid credentials (do not reveal if email exists)
    if (!user || !user.password_hash) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(String(password), user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const token = generateToken(user);
    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      token
    });
  } catch (err) {
    console.error('[Auth API] Login error:', err);
    return res.status(500).json({ success: false, error: 'Login failed due to a server error.' });
  }
});

// -------------------------------------------------------------
// 3. LOGOUT
// -------------------------------------------------------------
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
});

// -------------------------------------------------------------
// 4. CURRENT USER
// -------------------------------------------------------------
router.get('/me', authMiddleware, (req, res) => {
  return res.status(200).json({
    success: true,
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email
    }
  });
});

// -------------------------------------------------------------
// 5. CHANGE PASSWORD
// -------------------------------------------------------------
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current password and new password are required.' });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters and contain both letters and numbers/symbols.'
      });
    }

    const user = await userStorage.findById(req.user.id);
    if (!user || !user.password_hash) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(String(currentPassword), user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect.' });
    }

    const saltRounds = 12;
    const newHash = await bcrypt.hash(String(newPassword), saltRounds);

    await userStorage.updateUser(user.id, {
      password_hash: newHash
    });

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (err) {
    console.error('[Auth API] Change password error:', err);
    return res.status(500).json({ success: false, error: 'Failed to change password due to a server error.' });
  }
});

// -------------------------------------------------------------
// 6. FORGOT PASSWORD
// -------------------------------------------------------------
router.post('/forgot-password', rateLimiter({ max: 8, message: 'Too many reset requests. Please try again later.' }), async (req, res) => {
  try {
    const { email } = req.body || {};
    const genericResponse = {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    };

    if (!validateEmail(email)) {
      // Still return generic message to avoid leaking email validity
      return res.status(200).json(genericResponse);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await userStorage.findByEmail(normalizedEmail);

    if (user) {
      // 1. Generate cryptographically secure random token (32 bytes)
      const rawToken = crypto.randomBytes(32).toString('hex');

      // 2. Hash token with SHA-256 for database storage
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      // 3. Set short expiration (15 minutes)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await userStorage.updateUser(user.id, {
        reset_token_hash: tokenHash,
        reset_token_expires_at: expiresAt
      });

      // 4. Send reset email via modular email service
      emailService.sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetToken: rawToken
      }).catch(err => {
        console.warn('[Auth API] Failed to deliver password reset email:', err.message);
      });
    }

    return res.status(200).json(genericResponse);
  } catch (err) {
    console.error('[Auth API] Forgot password error:', err);
    return res.status(500).json({ success: false, error: 'Failed to process request.' });
  }
});

// -------------------------------------------------------------
// 7. RESET PASSWORD
// -------------------------------------------------------------
router.post('/reset-password', rateLimiter({ max: 10, message: 'Too many reset attempts. Please try again later.' }), async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, error: 'Reset token and new password are required.' });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters and contain both letters and numbers/symbols.'
      });
    }

    // Hash incoming token with SHA-256 to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(String(token).trim()).digest('hex');
    const user = await userStorage.findByResetTokenHash(tokenHash);

    if (!user || !user.reset_token_expires_at) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired password reset token.'
      });
    }

    const expiresTime = new Date(user.reset_token_expires_at).getTime();
    if (Date.now() > expiresTime) {
      // Invalidate expired token
      await userStorage.updateUser(user.id, {
        reset_token_hash: '',
        reset_token_expires_at: ''
      });
      return res.status(400).json({
        success: false,
        error: 'Password reset link has expired. Please request a new one.'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const newHash = await bcrypt.hash(String(newPassword), saltRounds);

    // Single-use token: clear reset token fields and save new password
    await userStorage.updateUser(user.id, {
      password_hash: newHash,
      reset_token_hash: '',
      reset_token_expires_at: ''
    });

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.'
    });
  } catch (err) {
    console.error('[Auth API] Reset password error:', err);
    return res.status(500).json({ success: false, error: 'Failed to reset password due to a server error.' });
  }
});

module.exports = router;
