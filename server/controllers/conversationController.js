const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { isObjectId } = require('../utils/validation');
const { directKeyFor, createConversationSalt } = require('../utils/conversations');
const { onlineUsers } = require('../sockets/state');

const serializeParticipant = (user) => ({
  id: user._id,
  username: user.username,
  avatarSeed: user.avatarSeed,
  isOnline: onlineUsers.has(user._id.toString()),
  lastSeen: user.lastSeen,
});

const serializeConversation = (conversation, currentUserId) => {
  const participant = conversation.memberIds.find((member) => member._id.toString() !== currentUserId);
  return {
    id: conversation._id,
    keySalt: conversation.keySalt,
    participant: participant ? serializeParticipant(participant) : null,
    lastMessageAt: conversation.lastMessageAt,
  };
};

exports.createDirectConversation = async (req, res) => {
  const { userId } = req.body || {};
  if (!isObjectId(userId) || userId === req.userId) {
    return res.status(400).json({ error: 'Invalid conversation participant' });
  }

  try {
    const participant = await User.findById(userId).select('_id username avatarSeed lastSeen');
    if (!participant) return res.status(404).json({ error: 'User not found' });

    const directKey = directKeyFor(req.userId, userId);
    let conversation = await Conversation.findOne({ directKey }).populate('memberIds', 'username avatarSeed lastSeen');
    if (!conversation) {
      try {
        conversation = await Conversation.create({
          directKey,
          memberIds: [req.userId, userId],
          keySalt: createConversationSalt(),
        });
        await conversation.populate('memberIds', 'username avatarSeed lastSeen');
      } catch (error) {
        if (error?.code !== 11000) throw error;
        conversation = await Conversation.findOne({ directKey }).populate('memberIds', 'username avatarSeed lastSeen');
      }
    }
    return res.status(201).json({ conversation: serializeConversation(conversation, req.userId) });
  } catch {
    return res.status(500).json({ error: 'Could not create conversation' });
  }
};

exports.getConversation = async (req, res) => {
  if (!isObjectId(req.params.conversationId)) return res.status(404).json({ error: 'Conversation not found' });
  const conversation = await Conversation.findOne({
    _id: req.params.conversationId,
    memberIds: req.userId,
  }).populate('memberIds', 'username avatarSeed lastSeen');
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  return res.json({ conversation: serializeConversation(conversation, req.userId) });
};

exports.getRecentChats = async (req, res) => {
  try {
    const conversations = await Conversation.find({ memberIds: req.userId })
      .sort({ lastMessageAt: -1 })
      .limit(50)
      .populate('memberIds', 'username avatarSeed lastSeen');

    const results = await Promise.all(conversations.map(async (conversation) => {
      const [lastMessage, unreadCount] = await Promise.all([
        Message.findOne({ conversationId: conversation._id, deletedAt: null }).sort({ createdAt: -1 }).select('payload createdAt'),
        Message.countDocuments({ conversationId: conversation._id, senderId: { $ne: req.userId }, isRead: false, deletedAt: null }),
      ]);
      return {
        ...serializeConversation(conversation, req.userId),
        lastMessage: lastMessage?.payload || null,
        lastMessageAt: lastMessage?.createdAt || conversation.lastMessageAt,
        unreadCount,
      };
    }));
    return res.json(results);
  } catch {
    return res.status(500).json({ error: 'Could not load conversations' });
  }
};
