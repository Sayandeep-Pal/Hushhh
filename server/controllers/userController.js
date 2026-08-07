const User = require('../models/User');
const { onlineUsers } = require('../sockets/state');
const { normalizeUsername } = require('../utils/validation');

exports.searchUsers = async (req, res) => {
  const query = normalizeUsername(req.query.query);
  if (query.length < 3 || query.length > 20) return res.status(400).json({ error: 'Search must be 3-20 characters' });
  try {
    const users = await User.find({
      usernameNormalized: { $regex: `^${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, $options: 'i' },
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

exports.updatePushToken = async (req, res) => {
  const { pushToken } = req.body;
  try {
    await User.findByIdAndUpdate(req.userId, { pushToken });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
