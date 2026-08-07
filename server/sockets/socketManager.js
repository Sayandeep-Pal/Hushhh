const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { verifyAccessToken } = require('../middleware/authMiddleware');
const { onlineUsers, pendingHandshakes } = require('./state');
const { sendPushNotification } = require('../utils/pushNotifications');
const { conversationRoom, userRoom, isConversationMember } = require('../utils/conversations');
const { isObjectId, isValidPayload, isValidClientMessageId } = require('../utils/validation');

const acknowledge = (ack, payload) => {
  if (typeof ack === 'function') ack(payload);
};

const validConversationFor = async (conversationId, userId) => isObjectId(conversationId)
  && isConversationMember(conversationId, userId);

const socketManager = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.sub).select('_id sessionVersion');
      if (!user || user.sessionVersion !== decoded.sessionVersion) return next(new Error('unauthorized'));
      socket.userId = user._id.toString();
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    const existingSockets = onlineUsers.get(userId) || new Set();
    existingSockets.add(socket.id);
    onlineUsers.set(userId, existingSockets);
    socket.join(userRoom(userId));
    await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
    if (existingSockets.size === 1) io.emit('user_status_change', { userId, status: 'online' });

    socket.on('join_conversation', async ({ conversationId } = {}, ack) => {
      if (!(await validConversationFor(conversationId, userId))) {
        return acknowledge(ack, { ok: false, error: 'conversation_not_found' });
      }
      socket.join(conversationRoom(conversationId));
      const pending = pendingHandshakes.get(conversationId);
      if (pending) socket.emit('key_change_requested', { conversationId, requesterId: pending.requesterId, requesterName: pending.requesterName });
      return acknowledge(ack, { ok: true });
    });

    socket.on('typing', async ({ conversationId } = {}, ack) => {
      if (!(await validConversationFor(conversationId, userId))) return acknowledge(ack, { ok: false, error: 'conversation_not_found' });
      socket.to(conversationRoom(conversationId)).emit('user_typing', { userId, conversationId });
      return acknowledge(ack, { ok: true });
    });

    socket.on('stop_typing', async ({ conversationId } = {}, ack) => {
      if (!(await validConversationFor(conversationId, userId))) return acknowledge(ack, { ok: false, error: 'conversation_not_found' });
      socket.to(conversationRoom(conversationId)).emit('user_stop_typing', { userId, conversationId });
      return acknowledge(ack, { ok: true });
    });

    socket.on('send_message', async ({ conversationId, payload, clientMessageId } = {}, ack) => {
      try {
        if (!(await validConversationFor(conversationId, userId))) return acknowledge(ack, { ok: false, error: 'conversation_not_found' });
        if (!isValidPayload(payload) || !isValidClientMessageId(clientMessageId)) {
          return acknowledge(ack, { ok: false, error: 'invalid_message' });
        }

        let message = await Message.findOne({ senderId: userId, clientMessageId });
        if (message && message.conversationId.toString() !== conversationId) {
          return acknowledge(ack, { ok: false, error: 'duplicate_message_id' });
        }
        if (!message) {
          message = await Message.create({ conversationId, senderId: userId, payload, clientMessageId });
          await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: message.createdAt });
        }

        const event = {
          id: message._id.toString(),
          conversationId,
          senderId: userId,
          payload: message.payload,
          clientMessageId: message.clientMessageId,
          createdAt: message.createdAt,
        };
        io.to(conversationRoom(conversationId)).emit('receive_message', event);
        acknowledge(ack, { ok: true, message: event });

        const conversation = await Conversation.findById(conversationId).select('memberIds');
        const recipientId = conversation?.memberIds.find((memberId) => memberId.toString() !== userId)?.toString();
        if (recipientId) {
          const sender = await User.findById(userId).select('username');
          sendPushNotification(recipientId, sender?.username || 'Someone', conversationId);
        }
      } catch {
        acknowledge(ack, { ok: false, error: 'message_not_saved' });
      }
    });

    socket.on('delete_message', async ({ messageId, conversationId } = {}, ack) => {
      try {
        if (!(await validConversationFor(conversationId, userId)) || !isObjectId(messageId)) {
          return acknowledge(ack, { ok: false, error: 'conversation_not_found' });
        }
        const message = await Message.findOne({ _id: messageId, conversationId, senderId: userId, deletedAt: null });
        if (!message) return acknowledge(ack, { ok: false, error: 'message_not_found' });
        message.deletedAt = new Date();
        message.deletedBy = userId;
        await message.save();
        io.to(conversationRoom(conversationId)).emit('message_deleted', { messageId, conversationId });
        return acknowledge(ack, { ok: true });
      } catch {
        return acknowledge(ack, { ok: false, error: 'message_not_deleted' });
      }
    });

    // The current UI uses these as an out-of-band key-change prompt only. No secret is accepted or transported.
    socket.on('request_key_change', async ({ conversationId } = {}, ack) => {
      if (!(await validConversationFor(conversationId, userId))) return acknowledge(ack, { ok: false, error: 'conversation_not_found' });
      const user = await User.findById(userId).select('username');
      pendingHandshakes.set(conversationId, { requesterId: userId, requesterName: user?.username || 'Unknown' });
      socket.to(conversationRoom(conversationId)).emit('key_change_requested', { conversationId, requesterId: userId, requesterName: user?.username || 'Unknown' });
      return acknowledge(ack, { ok: true });
    });

    socket.on('respond_key_change', async ({ conversationId, accepted } = {}, ack) => {
      if (!(await validConversationFor(conversationId, userId)) || typeof accepted !== 'boolean') return acknowledge(ack, { ok: false, error: 'conversation_not_found' });
      const pending = pendingHandshakes.get(conversationId);
      if (!pending || pending.requesterId === userId) return acknowledge(ack, { ok: false, error: 'handshake_not_found' });
      pendingHandshakes.delete(conversationId);
      const user = await User.findById(userId).select('username');
      io.to(conversationRoom(conversationId)).emit('key_change_responded', { conversationId, accepted, responderId: userId, responderName: user?.username || 'Unknown' });
      return acknowledge(ack, { ok: true });
    });

    socket.on('disconnect', async () => {
      const sockets = onlineUsers.get(userId);
      if (!sockets) return;
      sockets.delete(socket.id);
      if (sockets.size > 0) return;
      onlineUsers.delete(userId);
      await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
      io.emit('user_status_change', { userId, status: 'offline' });
    });
  });
};

module.exports = socketManager;
