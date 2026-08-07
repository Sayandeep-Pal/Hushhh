const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { createRateLimiter } = require('../middleware/rateLimit');

const authRateLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, key: (req) => `auth:${req.ip}` });

router.post('/register', authRateLimit, authController.register);
router.post('/session', authRateLimit, authController.createSession);
router.patch('/profile', authenticate, authController.updateProfile);
router.post('/sign-out-everywhere', authenticate, authController.signOutEverywhere);

module.exports = router;
