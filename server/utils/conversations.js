const crypto = require('crypto');
const Conversation = require('../models/Conversation');

const conversationRoom = (conversationId) => `conversation:${conversationId}`;
const userRoom = (userId) => `user:${userId}`;

const directKeyFor = (firstUserId, secondUserId) => [firstUserId.toString(), secondUserId.toString()]
  .sort()
  .join(':');

const isConversationMember = async (conversationId, userId) => Boolean(await Conversation.exists({
  _id: conversationId,
  memberIds: userId,
}));

const createConversationSalt = () => crypto.randomBytes(16).toString('base64url');

module.exports = { conversationRoom, userRoom, directKeyFor, isConversationMember, createConversationSalt };
