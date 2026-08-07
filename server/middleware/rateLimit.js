const buckets = new Map();

const createRateLimiter = ({ windowMs, max, key = (req) => req.ip }) => (req, res, next) => {
  const now = Date.now();
  const bucketKey = key(req);
  const current = buckets.get(bucketKey);
  const active = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  active.count += 1;
  buckets.set(bucketKey, active);
  if (active.count > max) {
    res.set('Retry-After', Math.ceil((active.resetAt - now) / 1000).toString());
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  return next();
};

module.exports = { createRateLimiter };
