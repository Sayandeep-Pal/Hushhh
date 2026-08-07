/*
 * Converts the pre-security-revision database shape without manufacturing credentials.
 * Run without --apply first. Applying requires explicit confirmation because legacy
 * identities are revoked and users must register a device-held credential again.
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { directKeyFor } = require('../utils/conversations');

const APPLY = process.argv.includes('--apply');
const CONFIRMATION = 'HUSHHH_REVOKE_LEGACY_IDENTITIES';

const parseLegacyRoomId = (roomId) => {
  if (typeof roomId !== 'string') return null;
  const members = roomId.split('_');
  if (members.length !== 2 || members[0] === members[1] || !members.every((member) => mongoose.Types.ObjectId.isValid(member))) return null;
  return members;
};

const legacyClientMessageId = (messageId) => `legacy_${messageId.toString()}`;
const createConversationSalt = () => crypto.randomBytes(16).toString('base64url');

const requireApplyConfirmation = () => {
  if (!APPLY) return false;
  if (process.env.MIGRATION_CONFIRM !== CONFIRMATION) {
    throw new Error(`Refusing to write. Set MIGRATION_CONFIRM=${CONFIRMATION} and pass --apply after a successful dry run.`);
  }
  return true;
};

const migrate = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  const apply = requireApplyConfirmation();
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const [legacyUsers, legacyMessages] = await Promise.all([
      User.collection.find({ $or: [{ credentialHash: { $exists: false } }, { usernameNormalized: { $exists: false } }] }).toArray(),
      Message.collection.find({ roomId: { $exists: true }, conversationId: { $exists: false } }).toArray(),
    ]);
    const report = { legacyUsers: legacyUsers.length, legacyMessages: legacyMessages.length, migratedConversations: 0, migratedMessages: 0, skippedMessages: 0 };

    if (!apply) {
      console.log(JSON.stringify({ mode: 'dry-run', ...report }, null, 2));
      return report;
    }

    for (const user of legacyUsers) {
      const usernameNormalized = typeof user.username === 'string' ? user.username.normalize('NFKC').trim().toLocaleLowerCase('en-US') : undefined;
      await User.collection.updateOne({ _id: user._id }, {
        $set: { usernameNormalized, requiresReRegistration: true, sessionVersion: (user.sessionVersion || 1) + 1 },
        $unset: { credentialHash: '' },
      });
    }

    const conversationsByKey = new Map();
    for (const message of legacyMessages) {
      const members = parseLegacyRoomId(message.roomId);
      if (!members) {
        report.skippedMessages += 1;
        continue;
      }
      const key = directKeyFor(members[0], members[1]);
      let conversation = conversationsByKey.get(key) || await Conversation.findOne({ directKey: key }).select('_id');
      if (!conversation) {
        const memberCount = await User.countDocuments({ _id: { $in: members } });
        if (memberCount !== 2) {
          report.skippedMessages += 1;
          continue;
        }
        conversation = await Conversation.create({ directKey: key, memberIds: members, keySalt: createConversationSalt(), lastMessageAt: message.createdAt || new Date() });
        report.migratedConversations += 1;
      }
      conversationsByKey.set(key, conversation);
      await Message.collection.updateOne({ _id: message._id }, {
        $set: { conversationId: conversation._id, clientMessageId: legacyClientMessageId(message._id), deletedAt: null, deletedBy: null },
        $unset: { roomId: '' },
      });
      report.migratedMessages += 1;
    }

    console.log(JSON.stringify({ mode: 'applied', ...report }, null, 2));
    return report;
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  require('dotenv').config();
  migrate().catch((error) => {
    console.error(`Legacy migration failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { parseLegacyRoomId, legacyClientMessageId, requireApplyConfirmation };
