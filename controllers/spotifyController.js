const spotifyService = require('../services/spotifyService');
const User = require('../models/User');
const logger = require('../services/loggerService');

const getAuthUrl = (req, res) => {
  const url = spotifyService.getAuthUrl();
  res.json({ success: true, url });
};

const callback = async (req, res) => {
  try {
    const { code } = req.query;
    const data = await spotifyService.spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token } = data.body;
    spotifyService.setTokens(access_token, refresh_token);

    // Save to MongoDB permanently
    const users = await User.find();
    if (users.length > 0) {
      await User.findByIdAndUpdate(users[0]._id, {
        spotifyTokens: {
          access_token,
          refresh_token,
          expires_at: new Date(Date.now() + 3600 * 1000)
        }
      });
      logger.success('Spotify tokens saved to DB', 'SPOTIFY_AUTH');
    }

    logger.success('Spotify connected', 'SPOTIFY_AUTH');
    res.redirect('http://127.0.0.1:3000/dashboard?spotify=connected');
  } catch (error) {
    logger.error(`Spotify callback error: ${error.message}`, 'SPOTIFY_ERROR');
    res.redirect('http://127.0.0.1:3000/settings?spotify=error');
  }
};

const play = async (req, res) => {
  try {
    const { query } = req.body;
    const track = await spotifyService.searchAndPlay(query);
    res.json({ success: true, track });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const pause = async (req, res) => {
  try {
    await spotifyService.pausePlayback();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const resume = async (req, res) => {
  try {
    await spotifyService.resumePlayback();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const next = async (req, res) => {
  try {
    await spotifyService.nextTrack();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const prev = async (req, res) => {
  try {
    await spotifyService.prevTrack();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const volume = async (req, res) => {
  try {
    const { level } = req.body;
    await spotifyService.setVolume(level);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const current = async (req, res) => {
  try {
    const track = await spotifyService.getCurrentTrack();
    res.json({ success: true, track });
  } catch (error) {
    res.status(500).json({ success: false, message: null });
  }
};

module.exports = { getAuthUrl, callback, play, pause, resume, next, prev, volume, current };
