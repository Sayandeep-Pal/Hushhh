const onlineUsers = new Map(); // userId -> Set<socketId>; replace with Redis before multi-instance deployment
const pendingHandshakes = new Map(); // roomId -> { requesterId, requesterName }

module.exports = { onlineUsers, pendingHandshakes };
