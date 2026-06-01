const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { generateDiscriminator } = require('../utils/helpers');
const { JWT_SECRET } = require('../middleware/authMiddleware');

exports.anonymousLogin = async (req, res) => {
  const { username, userId, avatarSeed } = req.body;
  
  try {
    let user;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId);
    }
    
    if (!user) {
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
};
