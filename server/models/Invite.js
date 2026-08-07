const mongoose = require('mongoose');

const inviteSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true, index: true },
  inviterId: { type: mongoose.Schema.Types.ObjectId, ref: 'hushUser', required: true, index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  usedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('hushInvite', inviteSchema);
