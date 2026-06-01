const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { onlineUsers, pendingHandshakes } = require('./state');
const User = require('../models/User');
const Message = require('../models/Message');
const { sendPushNotification } = require('../utils/pushNotifications');

const socketManager = (io) => {
  // Socket.io Auth Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next();
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) return next();
      socket.userId = decoded.userId.toString();
      next();
    });
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log('User connected:', socket.id, 'UserId:', userId);

    if (userId) {
      onlineUsers.set(userId, socket.id);
      socket.join(`user_${userId}`);
      await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
      io.emit('user_status_change', { userId: userId, status: 'online' });
    }

    socket.on('join_room', (roomId) => {
      socket.join(roomId);
      
      if (pendingHandshakes.has(roomId)) {
        const handshake = pendingHandshakes.get(roomId);
        socket.emit('receive_message', {
          type: 'KEY_CHANGE_REQUEST',
          senderId: handshake.requesterId,
          senderName: handshake.requesterName,
          roomId: roomId
        });
      }
    });

    socket.on('typing', (data) => {
      io.to(data.roomId).emit('user_typing', { userId: socket.userId, roomId: data.roomId });
    });

    socket.on('stop_typing', (data) => {
      io.to(data.roomId).emit('user_stop_typing', { userId: socket.userId, roomId: data.roomId });
    });

    socket.on('delete_message', async (data) => {
      try {
        const { messageId, roomId } = data;
        const message = await Message.findById(messageId);
        
        if (message && message.senderId.toString() === socket.userId) {
          message.isDeleted = true;
          await message.save();
          io.to(roomId).emit('message_deleted', { messageId });
        }
      } catch (e) {
        console.error('Failed to delete message', e);
      }
    });

    socket.on('send_message', async (data) => {
      try {
        if (data.type === 'KEY_CHANGE_REQUEST') {
          pendingHandshakes.set(data.roomId, {
            requesterId: data.senderId,
            requesterName: data.senderName
          });
          io.to(data.roomId).emit('receive_message', data);
          return;
        }
        
        if (data.type === 'KEY_CHANGE_ACCEPTED' || data.type === 'KEY_CHANGE_REJECTED') {
          pendingHandshakes.delete(data.roomId);
          io.to(data.roomId).emit('receive_message', data);
          return;
        }

        const newMessage = new Message({
          roomId: data.roomId,
          senderId: data.senderId,
          payload: data.payload
        });
        await newMessage.save();
        
        const messageData = {
          ...data,
          id: newMessage._id,
          createdAt: newMessage.createdAt
        };

        const [id1, id2] = data.roomId.split('_');
        const recipientId = id1 === data.senderId ? id2 : id1;

        io.to(data.roomId)
          .to(`user_${data.senderId}`)
          .to(`user_${recipientId}`)
          .emit('receive_message', messageData);

        if (recipientId && recipientId !== data.senderId) {
          const sender = await User.findById(data.senderId);
          sendPushNotification(recipientId, sender ? sender.username : 'Someone', data.roomId);
        }
      } catch (e) {
        console.error('Failed to save message', e);
      }
    });

    socket.on('disconnect', async () => {
      const userId = socket.userId;
      if (userId) {
        onlineUsers.delete(userId);
        await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
        io.emit('user_status_change', { userId: userId, status: 'offline' });
      }
    });
  });
};

module.exports = socketManager;
