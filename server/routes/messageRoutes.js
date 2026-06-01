const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/:roomId', authenticate, messageController.getMessageHistory);
router.post('/read/:roomId', authenticate, messageController.markAsRead);

module.exports = router;
