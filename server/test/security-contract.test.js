const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const validation = require('../utils/validation');
const { directKeyFor, conversationRoom, userRoom } = require('../utils/conversations');
const { signAccessToken, verifyAccessToken, JWT_AUDIENCE, JWT_ISSUER } = require('../middleware/authMiddleware');
const Message = require('../models/Message');

test('registration credentials require exactly 256 bits of hexadecimal entropy', () => {
  assert.equal(validation.isValidDeviceSecret('a'.repeat(64)), true);
  assert.equal(validation.isValidDeviceSecret('a'.repeat(63)), false);
  assert.equal(validation.isValidDeviceSecret('z'.repeat(64)), false);
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
