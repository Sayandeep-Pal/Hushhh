const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const { generateDiscriminator } = require('../utils/helpers');
const { signAccessToken } = require('../middleware/authMiddleware');
const { isValidDeviceSecret, isValidUsername, normalizeUsername, isObjectId } = require('../utils/validation');

const serializeUser = (user) => ({
  id: user._id,
  username: user.username,
  avatarSeed: user.avatarSeed,
});

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
  const { username, avatarSeed, deviceSecret } = req.body || {};
  if (!isValidUsername(username) || !isValidDeviceSecret(deviceSecret)) {
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
    return res.status(201).json({ token: signAccessToken(user), user: serializeUser(user) });
  } catch (error) {
    return res.status(500).json({ error: 'Could not create identity' });
  }
};

exports.createSession = async (req, res) => {
  const { userId, deviceSecret } = req.body || {};
  if (!isObjectId(userId) || !isValidDeviceSecret(deviceSecret)) {
    return res.status(401).json({ error: 'Invalid identity credentials' });
  }

  try {
    const user = await User.findById(userId).select('+credentialHash');
    if (!user || user.requiresReRegistration || !user.credentialHash || !(await bcrypt.compare(deviceSecret, user.credentialHash))) {
      return res.status(401).json({ error: 'Invalid identity credentials' });
    }
    return res.json({ token: signAccessToken(user), user: serializeUser(user) });
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
  await User.findByIdAndUpdate(req.userId, { $inc: { sessionVersion: 1 } });
  return res.status(204).send();
};
