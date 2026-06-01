const onlineUsers = new Map(); // userId -> socketId
const pendingHandshakes = new Map(); // roomId -> { requesterId, requesterName }

module.exports = { onlineUsers, pendingHandshakes };
