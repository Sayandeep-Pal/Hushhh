const User = require('../models/User');
const Message = require('../models/Message');
const mongoose = require('mongoose');
const { onlineUsers } = require('../sockets/state');

exports.getRecentChats = async (req, res) => {
  try {
    const myId = req.userId;
    
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

    const otherUserIds = recentMessages
      .map(m => m.otherUserId)
      .filter(id => mongoose.Types.ObjectId.isValid(id) && id !== myId);

    const recentUsers = await User.find({ _id: { $in: otherUserIds } }).select('username _id avatarSeed lastSeen');
    
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
};

exports.searchUsers = async (req, res) => {
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
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('username _id avatarSeed');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id, username: user.username, avatarSeed: user.avatarSeed, isOnline: onlineUsers.has(user._id.toString()) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.updatePushToken = async (req, res) => {
  const { pushToken } = req.body;
  try {
    await User.findByIdAndUpdate(req.userId, { pushToken });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
