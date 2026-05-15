const youtubeService = require('../services/youtubeService');
const { YoutubeHistory } = require('../models/NewModels');
const logger = require('../services/loggerService');

const search = async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;
    if (!q) return res.status(400).json({ success: false, message: 'Query required' });
    const videos = await youtubeService.searchVideos(q, parseInt(limit));
    res.json({ success: true, videos });
  } catch (error) {
    logger.error(`YouTube search error: ${error.message}`, 'YT_ERROR');
    res.status(500).json({ success: false, message: error.message });
  }
};

const getInfo = async (req, res) => {
  try {
    const { id, url } = req.query;
    let videoId = id;
    if (!videoId && url) videoId = youtubeService.getVideoIdFromUrl(url);
    if (!videoId) return res.status(400).json({ success: false, message: 'Video ID or URL required' });
    const info = await youtubeService.getVideoInfo(videoId);
    res.json({ success: true, video: info });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getChannelVideos = async (req, res) => {
  try {
    const { channel, limit = 5 } = req.query;
    if (!channel) return res.status(400).json({ success: false, message: 'Channel name required' });
    const videos = await youtubeService.searchChannelVideos(channel, parseInt(limit));
    res.json({ success: true, videos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getTrending = async (req, res) => {
  try {
    const videos = await youtubeService.getTrending();
    res.json({ success: true, videos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const saveToHistory = async (req, res) => {
  try {
    const { videoId, title, author, thumbnail, url, duration } = req.body;
    const existing = await YoutubeHistory.findOne({ userId: req.userId, videoId });
    if (existing) {
      existing.watchedAt = new Date();
      await existing.save();
    } else {
      await YoutubeHistory.create({ userId: req.userId, videoId, title, author, thumbnail, url, duration });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getHistory = async (req, res) => {
  try {
    const history = await YoutubeHistory.find({ userId: req.userId }).sort({ watchedAt: -1 }).limit(20);
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const toggleLike = async (req, res) => {
  try {
    const { videoId } = req.params;
    const video = await YoutubeHistory.findOne({ userId: req.userId, videoId });
    if (!video) return res.status(404).json({ success: false, message: 'Video not in history' });
    video.liked = !video.liked;
    await video.save();
    res.json({ success: true, liked: video.liked });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getLiked = async (req, res) => {
  try {
    const liked = await YoutubeHistory.find({ userId: req.userId, liked: true }).sort({ watchedAt: -1 });
    res.json({ success: true, videos: liked });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { search, getInfo, getChannelVideos, getTrending, saveToHistory, getHistory, toggleLike, getLiked };
