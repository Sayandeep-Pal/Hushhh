const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const socketManager = require('./sockets/socketManager');

const PORT = process.env.PORT || 3000;

// Connect to Database
connectDB();

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Set io instance to app to use in controllers
app.set('io', io);

// Initialize Socket Manager
socketManager(io);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
