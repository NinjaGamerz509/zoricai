const express = require('express');
const router = express.Router();
const { textToSpeech } = require('../controllers/voiceController');
const authMiddleware = require('../middleware/auth');

router.post('/tts', authMiddleware, textToSpeech);

module.exports = router;
