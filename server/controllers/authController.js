const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const RefreshSession = require('../models/RefreshSession');
const { generateDiscriminator } = require('../utils/helpers');
const { signAccessToken } = require('../middleware/authMiddleware');
const { isValidDeviceSecret, isValidDeviceId, isValidUsername, normalizeUsername, isObjectId } = require('../utils/validation');
const {
  createRefreshToken,
  hashRefreshToken,
  isValidRefreshToken,
  refreshTokenExpiry,
} = require('../utils/refreshTokens');

const serializeUser = (user) => ({
  id: user._id,
  username: user.username,
  avatarSeed: user.avatarSeed,
});

const issueSession = async (user, deviceId) => {
  const refreshToken = createRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);
  const now = new Date();
  // A device has one current refresh session. Old short-lived access tokens
  // remain bounded by their 15-minute expiry, while refresh access is revoked.
  await RefreshSession.updateMany(
    { userId: user._id, deviceId, revokedAt: null },
    { $set: { revokedAt: now } },
  );
  await RefreshSession.create({
    userId: user._id,
    tokenHash,
    deviceId,
    sessionVersion: user.sessionVersion,
    expiresAt: refreshTokenExpiry(now),
  });
  return { token: signAccessToken(user), refreshToken, user: serializeUser(user) };
};

const createUniqueUsername = async (requestedUsername) => {
  const baseUsername = normalizeUsername(requestedUsername);
  for (let attempts = 0; attempts < 20; attempts += 1) {
    const username = `${baseUsername}#${generateDiscriminator()}`;
    const usernameNormalized = username.toLocaleLowerCase('en-US');
    const existing = await User.exists({ usernameNormalized });
    if (!existing) return { username, usernameNormalized };
  }
  throw new Error('Could not generate a unique identity');
};

exports.register = async (req, res) => {
  const { username, avatarSeed, deviceSecret, deviceId } = req.body || {};
  if (!isValidUsername(username) || !isValidDeviceSecret(deviceSecret) || !isValidDeviceId(deviceId)) {
    return res.status(400).json({ error: 'Invalid registration payload' });
  }

  try {
    const identity = await createUniqueUsername(username);
    const credentialHash = await bcrypt.hash(deviceSecret, 12);
    const user = await User.create({
      ...identity,
      credentialHash,
      avatarSeed: typeof avatarSeed === 'string' && avatarSeed.length <= 128 ? avatarSeed : identity.username,
    });
    return res.status(201).json(await issueSession(user, deviceId));
  } catch (error) {
    return res.status(500).json({ error: 'Could not create identity' });
  }
};

exports.createSession = async (req, res) => {
  const { userId, deviceSecret, deviceId } = req.body || {};
  if (!isObjectId(userId) || !isValidDeviceSecret(deviceSecret) || !isValidDeviceId(deviceId)) {
    return res.status(401).json({ error: 'Invalid identity credentials' });
  }

  try {
    const user = await User.findById(userId).select('+credentialHash');
    if (!user || user.requiresReRegistration || !user.credentialHash || !(await bcrypt.compare(deviceSecret, user.credentialHash))) {
      return res.status(401).json({ error: 'Invalid identity credentials' });
    }
    return res.json(await issueSession(user, deviceId));
  } catch {
    return res.status(401).json({ error: 'Invalid identity credentials' });
  }
};

exports.updateProfile = async (req, res) => {
  const { username, avatarSeed } = req.body || {};
  if (username !== undefined && !isValidUsername(username)) {
    return res.status(400).json({ error: 'Invalid codename' });
  }
  if (avatarSeed !== undefined && (typeof avatarSeed !== 'string' || avatarSeed.length > 128)) {
    return res.status(400).json({ error: 'Invalid avatar seed' });
  }

  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Identity not found' });
    if (username !== undefined) {
      const discriminator = user.username.split('#')[1];
      user.username = `${normalizeUsername(username)}#${discriminator}`;
      user.usernameNormalized = user.username.toLocaleLowerCase('en-US');
    }
    if (avatarSeed !== undefined) user.avatarSeed = avatarSeed;
    await user.save();
    return res.json({ user: serializeUser(user) });
  } catch (error) {
    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
      return res.status(409).json({ error: 'Codename already exists' });
    }
    return res.status(500).json({ error: 'Could not update identity' });
  }
};

exports.signOutEverywhere = async (req, res) => {
  const now = new Date();
  await User.findByIdAndUpdate(req.userId, { $inc: { sessionVersion: 1 } });
  await RefreshSession.updateMany({ userId: req.userId, revokedAt: null }, { $set: { revokedAt: now } });
  return res.status(204).send();
};

exports.refresh = async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!isValidRefreshToken(refreshToken)) return res.status(401).json({ error: 'Invalid refresh session' });

  try {
    const now = new Date();
    const previousHash = hashRefreshToken(refreshToken);
    const nextRefreshToken = createRefreshToken();
    const nextHash = hashRefreshToken(nextRefreshToken);
    // findOneAndUpdate makes a refresh token single-use even when requests race.
    const previous = await RefreshSession.findOneAndUpdate(
      { tokenHash: previousHash, revokedAt: null, expiresAt: { $gt: now } },
      { $set: { revokedAt: now, replacedByHash: nextHash, lastUsedAt: now } },
      { new: false },
    );
    if (!previous) return res.status(401).json({ error: 'Invalid refresh session' });

    const user = await User.findById(previous.userId);
    if (!user || user.requiresReRegistration || user.sessionVersion !== previous.sessionVersion) {
      return res.status(401).json({ error: 'Invalid refresh session' });
    }
    await RefreshSession.create({
      userId: user._id,
      tokenHash: nextHash,
      deviceId: previous.deviceId,
      sessionVersion: user.sessionVersion,
      expiresAt: refreshTokenExpiry(now),
    });
    return res.json({ token: signAccessToken(user), refreshToken: nextRefreshToken, user: serializeUser(user) });
  } catch {
    return res.status(401).json({ error: 'Invalid refresh session' });
  }
};

exports.signOut = async (req, res) => {
  const { refreshToken } = req.body || {};
  if (isValidRefreshToken(refreshToken)) {
    await RefreshSession.updateOne(
      { userId: req.userId, tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }
  return res.status(204).send();
};
