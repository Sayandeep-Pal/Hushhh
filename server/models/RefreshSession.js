const mongoose = require('mongoose');

// Refresh tokens are deliberately never persisted. This collection only holds
// a SHA-256 hash, which lets us rotate and revoke sessions without turning a
// database read into a bearer-token compromise.
const refreshSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'hushUser', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, index: true },
  deviceId: { type: String, required: true, index: true },
  sessionVersion: { type: Number, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  revokedAt: { type: Date, default: null },
  replacedByHash: { type: String, default: null },
  lastUsedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

refreshSessionSchema.index({ userId: 1, deviceId: 1, revokedAt: 1 });

module.exports = mongoose.model('hushRefreshSession', refreshSessionSchema);
