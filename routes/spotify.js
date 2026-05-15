const express = require('express');
const router = express.Router();
const { getAuthUrl, callback, play, pause, resume, next, prev, volume, current } = require('../controllers/spotifyController');
const authMiddleware = require('../middleware/auth');

router.get('/auth', authMiddleware, getAuthUrl);
router.get('/callback', callback);
router.post('/play', authMiddleware, play);
router.post('/pause', authMiddleware, pause);
router.post('/resume', authMiddleware, resume);
router.post('/next', authMiddleware, next);
router.post('/prev', authMiddleware, prev);
router.put('/volume', authMiddleware, volume);
router.get('/current', authMiddleware, current);

module.exports = router;
