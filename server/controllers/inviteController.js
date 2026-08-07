const crypto = require('crypto');
const Invite = require('../models/Invite');
const Conversation = require('../models/Conversation');
const { directKeyFor, createConversationSalt } = require('../utils/conversations');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const serializeConversation = (conversation, userId) => ({
  id: conversation._id,
  keySalt: conversation.keySalt,
  participant: conversation.memberIds.find((member) => member._id.toString() !== userId),
});

exports.createInvite = async (req, res) => {
  const token = crypto.randomBytes(32).toString('base64url');
  try {
    await Invite.create({
      tokenHash: hashToken(token),
      inviterId: req.userId,
      expiresAt: new Date(Date.now() + (24 * 60 * 60 * 1000)),
    });
    return res.status(201).json({ token, expiresInSeconds: 24 * 60 * 60 });
  } catch {
    return res.status(500).json({ error: 'Could not create invite' });
  }
};

exports.acceptInvite = async (req, res) => {
  const { token } = req.body || {};
  if (typeof token !== 'string' || token.length < 32 || token.length > 128) {
    return res.status(400).json({ error: 'Invalid invite' });
  }
  try {
    const invite = await Invite.findOneAndUpdate(
      { tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date() } },
      { new: true },
    );
    if (!invite || invite.inviterId.toString() === req.userId) {
      return res.status(404).json({ error: 'Invite not found or expired' });
    }
    const directKey = directKeyFor(req.userId, invite.inviterId);
    let conversation = await Conversation.findOne({ directKey }).populate('memberIds', 'username avatarSeed lastSeen');
    if (!conversation) {
      try {
        conversation = await Conversation.create({
          directKey,
          memberIds: [req.userId, invite.inviterId],
          keySalt: createConversationSalt(),
        });
        await conversation.populate('memberIds', 'username avatarSeed lastSeen');
      } catch (error) {
        if (error?.code !== 11000) throw error;
        conversation = await Conversation.findOne({ directKey }).populate('memberIds', 'username avatarSeed lastSeen');
      }
    }
    return res.json({ conversation: serializeConversation(conversation, req.userId) });
  } catch {
    return res.status(500).json({ error: 'Could not accept invite' });
  }
};
