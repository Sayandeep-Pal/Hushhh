const Message = require('../models/Message');
const mongoose = require('mongoose');

exports.getMessageHistory = async (req, res) => {
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
};

exports.markAsRead = async (req, res) => {
  try {
    const { roomId } = req.params;
    const myId = req.userId.toString();
    const myObjectId = new mongoose.Types.ObjectId(myId);
    const io = req.app.get('io');
    
    await Message.updateMany(
      { 
        roomId, 
        senderId: { $ne: myObjectId }, 
        isRead: { $ne: true } 
      },
      { $set: { isRead: true } }
    );
    
    if (io) {
      io.to(`user_${myId}`).emit('messages_read', { roomId });
    }
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
