const express = require('express');
const router = express.Router();
const { sendMessage, getHistory, clearHistory } = require('../controllers/chatController');
const authMiddleware = require('../middleware/auth');
const { chatLimiter } = require('../middleware/rateLimiter');

router.post('/', authMiddleware, chatLimiter, sendMessage);
router.get('/history', authMiddleware, getHistory);
router.delete('/history', authMiddleware, clearHistory);

module.exports = router;
