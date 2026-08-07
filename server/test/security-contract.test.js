const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const validation = require('../utils/validation');
const User = require('../models/User');
const { directKeyFor, conversationRoom, userRoom } = require('../utils/conversations');
const { signAccessToken, verifyAccessToken, JWT_AUDIENCE, JWT_ISSUER } = require('../middleware/authMiddleware');
const Message = require('../models/Message');
const { parseLegacyRoomId, legacyClientMessageId } = require('../scripts/migrate-legacy-data');
const { createRateLimiter } = require('../middleware/rateLimit');
const authController = require('../controllers/authController');
const RefreshSession = require('../models/RefreshSession');
const {
  createRefreshToken,
  hashRefreshToken,
  isValidRefreshToken,
  refreshTokenExpiry,
  REFRESH_TOKEN_TTL_MS,
} = require('../utils/refreshTokens');

test('registration credentials require exactly 256 bits of hexadecimal entropy', () => {
  assert.equal(validation.isValidDeviceSecret('a'.repeat(64)), true);
  assert.equal(validation.isValidDeviceSecret('a'.repeat(63)), false);
  assert.equal(validation.isValidDeviceSecret('z'.repeat(64)), false);
  assert.equal(validation.isValidDeviceId('b'.repeat(64)), true);
  assert.equal(validation.isValidDeviceId('short-device-id'), false);
});

test('refresh tokens are opaque, hashable, and have a bounded expiry', () => {
  const token = createRefreshToken();
  assert.equal(isValidRefreshToken(token), true);
  assert.equal(isValidRefreshToken(`${token}=`), false);
  assert.match(hashRefreshToken(token), /^[a-f0-9]{64}$/);
  assert.notEqual(hashRefreshToken(token), token);
  const now = new Date('2026-01-01T00:00:00.000Z');
  assert.equal(refreshTokenExpiry(now).getTime() - now.getTime(), REFRESH_TOKEN_TTL_MS);
});

test('refresh sessions persist only token hashes and support server-side revocation', () => {
  const paths = RefreshSession.schema.paths;
  assert.ok(paths.tokenHash);
  assert.ok(paths.deviceId);
  assert.ok(paths.revokedAt);
  assert.ok(paths.replacedByHash);
  assert.ok(paths.expiresAt);
  const hasDeviceIndex = RefreshSession.schema.indexes().some(([spec]) => (
    spec.userId === 1 && spec.deviceId === 1 && spec.revokedAt === 1
  ));
  assert.equal(hasDeviceIndex, true);
});

test('refresh endpoint rotates a token once and persists only the replacement hash', async () => {
  const oldRefreshToken = createRefreshToken();
  const oldHash = hashRefreshToken(oldRefreshToken);
  const userId = '507f1f77bcf86cd799439011';
  const deviceId = 'c'.repeat(64);
  const originalFindOneAndUpdate = RefreshSession.findOneAndUpdate;
  const originalCreate = RefreshSession.create;
  const originalFindById = User.findById;
  let oldTokenActive = true;
  let persistedReplacement = null;

  RefreshSession.findOneAndUpdate = async (filter, update) => {
    assert.equal(filter.tokenHash, oldHash);
    assert.equal(filter.revokedAt, null);
    assert.ok(filter.expiresAt.$gt instanceof Date);
    assert.ok(update.$set.replacedByHash);
    if (!oldTokenActive) return null;
    oldTokenActive = false;
    return { userId, deviceId, sessionVersion: 4 };
  };
  RefreshSession.create = async (session) => { persistedReplacement = session; return session; };
  User.findById = async () => ({
    _id: { toString: () => userId },
    sessionVersion: 4,
    username: 'Agent#1234',
    avatarSeed: 'Agent',
    requiresReRegistration: false,
  });

  const response = () => {
    const result = { statusCode: 200, body: null };
    const res = {
      result,
      status: (code) => { result.statusCode = code; return res; },
      json: (body) => { result.body = body; return res; },
    };
    return res;
  };

  try {
    const first = response();
    await authController.refresh({ body: { refreshToken: oldRefreshToken } }, first);
    assert.equal(first.result.statusCode, 200);
    assert.notEqual(first.result.body.refreshToken, oldRefreshToken);
    assert.equal(hashRefreshToken(first.result.body.refreshToken), persistedReplacement.tokenHash);
    assert.equal(persistedReplacement.deviceId, deviceId);
    assert.equal(persistedReplacement.sessionVersion, 4);

    const replay = response();
    await authController.refresh({ body: { refreshToken: oldRefreshToken } }, replay);
    assert.equal(replay.result.statusCode, 401);
  } finally {
    RefreshSession.findOneAndUpdate = originalFindOneAndUpdate;
    RefreshSession.create = originalCreate;
    User.findById = originalFindById;
  }
});

test('user search and message fields are bounded and normalized', () => {
  assert.equal(validation.normalizeUsername('  Agent   Écho  '), 'Agent Écho');
  assert.equal(validation.isValidUsername('Agent_01'), true);
  assert.equal(validation.isValidUsername('ab'), false);
  assert.equal(validation.isValidPayload('payload'), true);
  assert.equal(validation.isValidPayload(''), false);
  assert.equal(validation.isValidPayload('x'.repeat(validation.MAX_PAYLOAD_LENGTH + 1)), false);
  assert.equal(validation.isValidClientMessageId('m_12345678'), true);
  assert.equal(validation.isValidClientMessageId('bad id'), false);
});

test('conversation room names are private namespaces and direct keys are stable', () => {
  assert.equal(directKeyFor('b', 'a'), 'a:b');
  assert.equal(directKeyFor('a', 'b'), 'a:b');
  assert.equal(conversationRoom('conversation-id'), 'conversation:conversation-id');
  assert.equal(userRoom('user-id'), 'user:user-id');
});

test('access tokens are audience-bound, expiring JWTs', () => {
  const user = { _id: { toString: () => '507f1f77bcf86cd799439011' }, sessionVersion: 2 };
  const token = signAccessToken(user);
  const verified = verifyAccessToken(token);
  assert.equal(verified.sub, '507f1f77bcf86cd799439011');
  assert.equal(verified.sessionVersion, 2);
  assert.equal(verified.aud, JWT_AUDIENCE);
  assert.equal(verified.iss, JWT_ISSUER);

  const wrongAudience = jwt.sign(
    { sub: user._id.toString(), sessionVersion: 2 },
    process.env.JWT_SECRET,
    { issuer: JWT_ISSUER, audience: 'another-client', expiresIn: '15m' },
  );
  assert.throws(() => verifyAccessToken(wrongAudience));
});

test('messages persist deletion and idempotency fields', () => {
  const paths = Message.schema.paths;
  assert.ok(paths.conversationId);
  assert.ok(paths.clientMessageId);
  assert.ok(paths.deletedAt);
  const hasIdempotencyIndex = Message.schema.indexes().some(([spec, options]) => (
    spec.senderId === 1 && spec.clientMessageId === 1 && options.unique
  ));
  assert.equal(hasIdempotencyIndex, true);
});

test('legacy migration accepts only canonical two-user room identifiers', () => {
  const first = '507f1f77bcf86cd799439011';
  const second = '507f1f77bcf86cd799439012';
  assert.deepEqual(parseLegacyRoomId(`${first}_${second}`), [first, second]);
  assert.equal(parseLegacyRoomId(`${first}_${first}`), null);
  assert.equal(parseLegacyRoomId('not-a-room'), null);
  assert.equal(legacyClientMessageId('507f1f77bcf86cd799439013'), 'legacy_507f1f77bcf86cd799439013');
});

test('rate limits return 429 after the configured request budget', () => {
  const testKey = `test-${Date.now()}`;
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2, key: () => testKey });
  const run = () => {
    const response = { headers: {}, statusCode: 200, body: null };
    const res = {
      set: (name, value) => { response.headers[name] = value; },
      status: (code) => { response.statusCode = code; return res; },
      json: (body) => { response.body = body; return res; },
    };
    let continued = false;
    limiter({ ip: '127.0.0.1' }, res, () => { continued = true; });
    return { response, continued };
  };
  assert.equal(run().continued, true);
  assert.equal(run().continued, true);
  const limited = run();
  assert.equal(limited.continued, false);
  assert.equal(limited.response.statusCode, 429);
  assert.match(limited.response.body.error, /Too many requests/);
});
