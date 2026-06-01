const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Expo } = require('expo-server-sdk');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const expo = new Expo();

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/funchat';
const JWT_SECRET = process.env.JWT_SECRET || 'secret-agent-key';

// MongoDB Models
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  avatarSeed: { type: String },
  pushToken: { type: String },
  lastSeen: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'funchatUser', required: true },
  payload: { type: String, required: true }, // Emoji string
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('funchatUser', userSchema);
const Message = mongoose.model('funchatMessage', messageSchema);

// Middleware
app.use(cors());
app.use(express.json());

// Auth Middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.userId = decoded.userId;
    next();
  });
};

// Socket.io Tracking
const onlineUsers = new Map(); // userId -> socketId (simplified)
const pendingHandshakes = new Map(); // roomId -> { requesterId, requesterName }

// Socket.io Auth Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(); // Allow connection but won't be "online" in registry
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next();
    socket.userId = decoded.userId.toString();
    next();
  });
});

// Database Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes

// Helper to generate unique discriminator
const generateDiscriminator = () => {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Anonymous Login / Identity Creation
app.post('/api/auth/anonymous', async (req, res) => {
  const { username, userId, avatarSeed } = req.body;
  
  try {
    let user;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId);
    }
    
    if (!user) {
      // Strip any existing hash to avoid double-discriminators
      const baseUsername = (username || 'Agent').split('#')[0];
      let finalUsername;
      let isUnique = false;
      let attempts = 0;
      
      while (!isUnique && attempts < 10) {
        const discriminator = generateDiscriminator();
        finalUsername = `${baseUsername}#${discriminator}`;
        const existing = await User.findOne({ username: finalUsername });
        if (!existing) {
          isUnique = true;
        }
        attempts++;
      }
      
      if (!isUnique) return res.status(500).json({ error: 'Could not generate unique identity' });
      
      user = new User({ 
        username: finalUsername,
        avatarSeed: avatarSeed || finalUsername 
      });
      await user.save();
    } else {
      let changed = false;
      if (username && user.username !== username) {
        const baseUsername = username.split('#')[0];
        const existingDiscriminator = user.username.split('#')[1] || generateDiscriminator();
        user.username = `${baseUsername}#${existingDiscriminator}`;
        changed = true;
      }
      if (avatarSeed && user.avatarSeed !== avatarSeed) {
        user.avatarSeed = avatarSeed;
        changed = true;
      }
      if (changed) await user.save();
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET);
    res.json({ token, user: { id: user._id, username: user.username, avatarSeed: user.avatarSeed } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Online Users - DELETED as per Phase 1 (Privacy)
// app.get('/api/users/online', authenticate, ...)

// Recent Chats
app.get('/api/users/recent', authenticate, async (req, res) => {
  try {
    const myId = req.userId;
    const myObjectId = new mongoose.Types.ObjectId(myId);
    
    // Find latest messages and unread counts for each room I'm in
    const recentMessages = await Message.aggregate([
      { 
        $match: { 
          $or: [
            { roomId: { $regex: `^${myId}_` } },
            { roomId: { $regex: `_${myId}$` } }
          ]
        } 
      },
      { $sort: { createdAt: -1 } },
      { 
        $group: { 
          _id: "$roomId", 
          lastMessageAt: { $first: "$createdAt" },
          lastMessage: { $first: "$payload" },
          otherUserId: { $first: { 
            $cond: [
              { $eq: [{ $arrayElemAt: [{ $split: ["$roomId", "_"] }, 0] }, myId] },
              { $arrayElemAt: [{ $split: ["$roomId", "_"] }, 1] },
              { $arrayElemAt: [{ $split: ["$roomId", "_"] }, 0] }
            ]
          }},
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [
                  { $ne: [{ $toString: "$senderId" }, myId.toString()] },
                  { $ne: ["$isRead", true] }
                ]},
                1,
                0
              ]
            }
          }
        } 
      },
      { $sort: { lastMessageAt: -1 } }
    ]);

    // DEBUG: Log the unread counts specifically
    console.log(`[DEBUG] Unread counts for ${myId}:`, recentMessages.map(m => ({ room: m._id, unread: m.unreadCount })));

    const otherUserIds = recentMessages
      .map(m => m.otherUserId)
      .filter(id => mongoose.Types.ObjectId.isValid(id) && id !== myId);

    const recentUsers = await User.find({ _id: { $in: otherUserIds } }).select('username _id avatarSeed lastSeen');
    
    // Maintain the order from aggregation
    const orderedUsers = recentMessages.map(m => {
      const user = recentUsers.find(u => u._id.toString() === m.otherUserId.toString());
      if (!user) return null;
      return {
        id: user._id,
        username: user.username,
        avatarSeed: user.avatarSeed,
        isOnline: onlineUsers.has(user._id.toString()),
        lastSeen: user.lastSeen,
        lastMessage: m.lastMessage,
        lastMessageAt: m.lastMessageAt,
        unreadCount: m.unreadCount
      };
    }).filter(u => u !== null);
    
    res.json(orderedUsers);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mark messages as read
app.post('/api/messages/read/:roomId', authenticate, async (req, res) => {
  try {
    const { roomId } = req.params;
    const myId = req.userId.toString();
    const myObjectId = new mongoose.Types.ObjectId(myId);
    
    console.log(`[READ_MESSAGES] User ${myId} marking room ${roomId} as read`);
    
    const result = await Message.updateMany(
      { 
        roomId, 
        senderId: { $ne: myObjectId }, 
        isRead: { $ne: true } 
      },
      { $set: { isRead: true } }
    );
    
    console.log(`[READ_MESSAGES] Result: matched ${result.matchedCount}, modified ${result.modifiedCount}`);
    
    // Notify the user's sockets to refresh unread counts
    io.to(`user_${myId}`).emit('messages_read', { roomId });
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// User Search
app.get('/api/users/search', authenticate, async (req, res) => {
  const { query } = req.query;
  try {
    const users = await User.find({
      username: { $regex: query || '', $options: 'i' },
      _id: { $ne: req.userId }
    }).limit(10).select('username _id avatarSeed lastSeen');
    
    res.json(users.map(u => ({ 
      id: u._id, 
      username: u.username,
      avatarSeed: u.avatarSeed,
      isOnline: onlineUsers.has(u._id.toString()),
      lastSeen: u.lastSeen
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Single User Fetch
app.get('/api/users/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('username _id avatarSeed');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id, username: user.username, avatarSeed: user.avatarSeed, isOnline: onlineUsers.has(user._id.toString()) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Message History
app.get('/api/messages/:roomId', authenticate, async (req, res) => {
  try {
    const messages = await Message.find({ roomId: req.params.roomId })
      .sort({ createdAt: 1 })
      .populate('senderId', 'username');
      
    res.json(messages.map(m => ({
      id: m._id,
      roomId: m.roomId,
      senderId: m.senderId ? m.senderId._id : null,
      sender: { username: m.senderId ? m.senderId.username : 'Unknown' },
      payload: m.payload,
      createdAt: m.createdAt
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update Push Token
app.post('/api/users/push-token', authenticate, async (req, res) => {
  const { pushToken } = req.body;
  try {
    await User.findByIdAndUpdate(req.userId, { pushToken });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (req, res) => {
  res.send('Fun Chat MongoDB Server is running');
});

// Helper for Push Notifications
const sendPushNotification = async (userId, senderUsername, roomId) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.pushToken) return;

    if (!Expo.isExpoPushToken(user.pushToken)) {
      console.error(`Push token ${user.pushToken} is not a valid Expo push token`);
      return;
    }

    const messages = [{
      to: user.pushToken,
      sound: 'default',
      title: 'New Secure Message 🔒',
      body: `${senderUsername} sent you a message`,
      data: { senderUsername, roomId },
      priority: 'high',
      badge: 1,
    }];

    const chunks = expo.chunkPushNotifications(messages);
    for (let chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
      }
    }
  } catch (e) {
    console.error('Push notification error:', e);
  }
};

// Socket.io
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
    
    // Check if there is a pending handshake for this room
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
      // Handle Handshake events
      if (data.type === 'KEY_CHANGE_REQUEST') {
        pendingHandshakes.set(data.roomId, {
          requesterId: data.senderId,
          requesterName: data.senderName
        });
        io.to(data.roomId).emit('receive_message', data);
        return;
      }
      
      if (data.type === 'KEY_CHANGE_ACCEPTED') {
        pendingHandshakes.delete(data.roomId);
        io.to(data.roomId).emit('receive_message', data);
        return;
      }

      if (data.type === 'KEY_CHANGE_REJECTED') {
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

      // Handle Push Notifications for the recipient
      const [id1, id2] = data.roomId.split('_');
      const recipientId = id1 === data.senderId ? id2 : id1;

      // Broadcast to room AND both users' private rooms (for homepage updates)
      io.to(data.roomId)
        .to(`user_${data.senderId}`)
        .to(`user_${recipientId}`)
        .emit('receive_message', messageData);

      // Always send Push Notification to recipient (Client handles foreground suppression)
      if (recipientId && recipientId !== data.senderId) {
        // Fetch sender username for notification
        const sender = await User.findById(data.senderId);
        sendPushNotification(recipientId, sender ? sender.username : 'Someone', data.roomId);
      }
    } catch (e) {
      console.error('Failed to save message', e);
    }
  });

  socket.on('disconnect', async () => {
    const userId = socket.userId;
    console.log('User disconnected:', socket.id, 'UserId:', userId);
    if (userId) {
      // Only remove if this was the last socket for this user
      // (Simplified: assuming one connection per user for now)
      onlineUsers.delete(userId);
      await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
      io.emit('user_status_change', { userId: userId, status: 'offline' });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
