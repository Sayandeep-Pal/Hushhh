const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  usernameNormalized: { type: String, unique: true, required: true, index: true },
  credentialHash: { type: String, required: true, select: false },
  sessionVersion: { type: Number, default: 1 },
  avatarSeed: { type: String },
  pushToken: { type: String },
  lastSeen: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('hushUser', userSchema);
