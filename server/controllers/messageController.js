const Message = require('../models/Message');
const { isObjectId } = require('../utils/validation');
const { isConversationMember } = require('../utils/conversations');

const getConversationId = (req) => req.params.conversationId;

const requireMembership = async (req, res) => {
  const conversationId = getConversationId(req);
  if (!isObjectId(conversationId) || !(await isConversationMember(conversationId, req.userId))) {
    res.status(404).json({ error: 'Conversation not found' });
    return false;
  }
  return true;
};

exports.getMessageHistory = async (req, res) => {
  try {
    if (!(await requireMembership(req, res))) return;
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
    const query = { conversationId: getConversationId(req), deletedAt: null };
    if (req.query.before && isObjectId(req.query.before)) {
      const cursor = await Message.findById(req.query.before).select('createdAt conversationId');
      if (!cursor || cursor.conversationId.toString() !== getConversationId(req)) {
        return res.status(400).json({ error: 'Invalid cursor' });
      }
      query.createdAt = { $lt: cursor.createdAt };
    }
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .populate('senderId', 'username');
    const hasMore = messages.length > limit;
    const page = (hasMore ? messages.slice(0, limit) : messages).reverse();
    return res.json({
      messages: page.map((message) => ({
        id: message._id,
        conversationId: message.conversationId,
        senderId: message.senderId ? message.senderId._id : null,
        sender: { username: message.senderId?.username || 'Unknown' },
        payload: message.payload,
        clientMessageId: message.clientMessageId,
        createdAt: message.createdAt,
      })),
      nextCursor: hasMore ? messages[limit - 1]._id : null,
    });
  } catch {
    return res.status(500).json({ error: 'Could not load message history' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    if (!(await requireMembership(req, res))) return;
    await Message.updateMany(
      { conversationId: getConversationId(req), senderId: { $ne: req.userId }, isRead: false, deletedAt: null },
      { $set: { isRead: true } },
    );
    const io = req.app.get('io');
    if (io) io.to(`user:${req.userId}`).emit('messages_read', { conversationId: getConversationId(req) });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: 'Could not update read state' });
  }
};
