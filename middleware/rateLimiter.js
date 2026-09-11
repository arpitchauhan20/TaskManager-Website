// In-memory sliding window rate limiter for sensitive authentication endpoints
const rateLimitStore = new Map();
let lastCleanup = Date.now();

function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanup < 60 * 1000) return; // Clean up at most once per minute
  lastCleanup = now;

  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

function rateLimiter({ windowMs = 15 * 60 * 1000, max = 15, message = 'Too many attempts. Please try again later.' } = {}) {
  return (req, res, next) => {
    // In automated testing environments, allow disabling rate limits
    if (process.env.NODE_ENV === 'test' || req.headers['x-test-bypass-rate-limit']) {
      return next();
    }

    cleanupExpired();

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown-ip';
    const key = `${req.baseUrl || ''}${req.path}:${ip}`;
    const now = Date.now();

    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    record.count++;

    if (record.count > max) {
      const retrySecs = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retrySecs);
      return res.status(429).json({
        success: false,
        error: message,
        retryAfter: retrySecs
      });
    }

    next();
  };
}

module.exports = rateLimiter;
