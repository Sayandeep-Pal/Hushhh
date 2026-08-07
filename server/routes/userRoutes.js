const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/authMiddleware');
const { createRateLimiter } = require('../middleware/rateLimit');

router.get('/search', authenticate, createRateLimiter({ windowMs: 60 * 1000, max: 30, key: (req) => `search:${req.userId}` }), userController.searchUsers);
router.post('/push-token', authenticate, userController.updatePushToken);

module.exports = router;
