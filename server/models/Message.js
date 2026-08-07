const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'hushConversation', required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'hushUser', required: true },
  payload: { type: String, required: true }, // Icon string with hidden data
  clientMessageId: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'hushUser', default: null },
  createdAt: { type: Date, default: Date.now }
});

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ senderId: 1, clientMessageId: 1 }, { unique: true });

module.exports = mongoose.model('hushMessage', messageSchema);
