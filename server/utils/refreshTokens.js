const { createHash, randomBytes } = require('crypto');

const REFRESH_TOKEN_BYTES = 32;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const createRefreshToken = () => randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
const hashRefreshToken = (token) => createHash('sha256').update(token).digest('hex');
const isValidRefreshToken = (token) => typeof token === 'string' && REFRESH_TOKEN_PATTERN.test(token);
const refreshTokenExpiry = (now = new Date()) => new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);

module.exports = {
  REFRESH_TOKEN_TTL_MS,
  createRefreshToken,
  hashRefreshToken,
  isValidRefreshToken,
  refreshTokenExpiry,
};
