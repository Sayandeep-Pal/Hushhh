const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const socketManager = require('./sockets/socketManager');
const { getAllowedOrigins, getJwtSecret } = require('./config/env');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: getAllowedOrigins(),
    methods: ["GET", "POST", "PATCH"]
  }
});

// Set io instance to app to use in controllers
app.set('io', io);

// Initialize Socket Manager
socketManager(io);

const start = async () => {
  getJwtSecret();
  await connectDB();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
};

start().catch((error) => {
  console.error('Server startup failed:', error.message);
  process.exit(1);
});
