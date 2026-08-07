const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/:conversationId', authenticate, messageController.getMessageHistory);
router.post('/read/:conversationId', authenticate, messageController.markAsRead);

module.exports = router;
