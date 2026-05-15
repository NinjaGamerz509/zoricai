// youtube.js routes
const express = require('express');
const router = express.Router();
const yt = require('../controllers/youtubeController');
const auth = require('../middleware/auth');

router.get('/search', auth, yt.search);
router.get('/info', auth, yt.getInfo);
router.get('/channel', auth, yt.getChannelVideos);
router.get('/trending', auth, yt.getTrending);
router.post('/history', auth, yt.saveToHistory);
router.get('/history', auth, yt.getHistory);
router.put('/like/:videoId', auth, yt.toggleLike);
router.get('/liked', auth, yt.getLiked);

module.exports = router;
