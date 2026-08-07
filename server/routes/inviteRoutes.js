const express = require('express');
const inviteController = require('../controllers/inviteController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authenticate);
router.post('/', inviteController.createInvite);
router.post('/accept', inviteController.acceptInvite);

module.exports = router;
