const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtSecret } = require('../config/env');

const JWT_ISSUER = 'hushhh-api';
const JWT_AUDIENCE = 'hushhh-client';

const signAccessToken = (user) => jwt.sign(
  { sub: user._id.toString(), sessionVersion: user.sessionVersion },
  getJwtSecret(),
  { expiresIn: '15m', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
);

const verifyAccessToken = (token) => jwt.verify(token, getJwtSecret(), {
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
});

const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.sub).select('_id sessionVersion');
    if (!user || user.sessionVersion !== decoded.sessionVersion) {
      return res.status(401).json({ error: 'Session is no longer valid' });
    }
    req.userId = user._id.toString();
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { authenticate, signAccessToken, verifyAccessToken, JWT_ISSUER, JWT_AUDIENCE };
