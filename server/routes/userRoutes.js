const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/recent', authenticate, userController.getRecentChats);
router.get('/search', authenticate, userController.searchUsers);
router.get('/:id', authenticate, userController.getUserById);
router.post('/push-token', authenticate, userController.updatePushToken);

module.exports = router;
