const express = require('express');
const conversationController = require('../controllers/conversationController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);
router.get('/recent', conversationController.getRecentChats);
router.post('/direct', conversationController.createDirectConversation);
router.get('/:conversationId', conversationController.getConversation);

module.exports = router;
