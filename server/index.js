const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/funchat';
const JWT_SECRET = process.env.JWT_SECRET || 'secret-agent-key';

// MongoDB Models
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  createdAt: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'funchatUser', required: true },
  payload: { type: String, required: true }, // Emoji string
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('funchatUser', userSchema);
const Message = mongoose.model('funchatMessage', messageSchema);

// Middleware
app.use(cors());
app.use(express.json());

// Auth Middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.userId = decoded.userId;
    next();
  });
};

// Database Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes

// Anonymous Login / Identity Creation
app.post('/api/auth/anonymous', async (req, res) => {
  const { username, userId } = req.body;
  
  try {
    let user;
    if (userId) {
      user = await User.findById(userId);
    }
    
    if (!user) {
      // Check if username taken
      const existing = await User.findOne({ username });
      if (existing) return res.status(400).json({ error: 'Codename already taken' });
      
      user = new User({ username });
      await user.save();
    } else if (username && user.username !== username) {
      user.username = username;
      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET);
    res.json({ token, user: { id: user._id, username: user.username } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// User Search
app.get('/api/users/search', authenticate, async (req, res) => {
  const { query } = req.query;
  try {
    const users = await User.find({
      username: { $regex: query || '', $options: 'i' },
      _id: { $ne: req.userId }
    }).limit(10).select('username _id');
    
    res.json(users.map(u => ({ id: u._id, username: u.username })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Single User Fetch
app.get('/api/users/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('username _id');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id, username: user.username });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Message History
app.get('/api/messages/:roomId', authenticate, async (req, res) => {
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
});

app.get('/', (req, res) => {
  res.send('Fun Chat MongoDB Server is running');
});

// Socket.io
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
  });

  socket.on('send_message', async (data) => {
    try {
      const newMessage = new Message({
        roomId: data.roomId,
        senderId: data.senderId,
        payload: data.payload
      });
      await newMessage.save();
      io.to(data.roomId).emit('receive_message', data);
    } catch (e) {
      console.error('Failed to save message', e);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
