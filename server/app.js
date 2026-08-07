const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const messageRoutes = require('./routes/messageRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const inviteRoutes = require('./routes/inviteRoutes');

const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: require('./config/env').getAllowedOrigins(), methods: ['GET', 'POST', 'PATCH'] }));
app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});

app.get('/', (req, res) => {
  res.send('Hushhh MongoDB Server is running');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/invites', inviteRoutes);

module.exports = app;
