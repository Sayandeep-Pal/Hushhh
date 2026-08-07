const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  directKey: { type: String, required: true, unique: true, index: true },
  memberIds: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'hushUser', required: true }],
    validate: {
      validator: (members) => Array.isArray(members) && members.length === 2,
      message: 'Direct conversations require exactly two members',
    },
  },
  keySalt: { type: String, required: true },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  createdAt: { type: Date, default: Date.now },
});

conversationSchema.index({ memberIds: 1, lastMessageAt: -1 });

module.exports = mongoose.model('hushConversation', conversationSchema);
