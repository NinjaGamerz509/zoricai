const Playlist = require('../models/Playlist');
const youtubeService = require('../services/youtubeService');
const groqService = require('../services/groqService');
const logger = require('../services/loggerService');

// Get all playlists
const getPlaylists = async (req, res) => {
  try {
    const playlists = await Playlist.find({ userId: req.userId }).sort({ updatedAt: -1 });
    res.json({ success: true, playlists });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// Create playlist
const createPlaylist = async (req, res) => {
  try {
    const { name, description, tags, mood } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name required' });
    const playlist = await Playlist.create({
      userId: req.userId, name, description: description || '', tags: tags || [], mood: mood || ''
    });
    logger.info(`Playlist created: ${name}`, 'PLAYLIST');
    res.json({ success: true, playlist });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// Delete playlist
const deletePlaylist = async (req, res) => {
  try {
    await Playlist.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// Add song to playlist
const addSong = async (req, res) => {
  try {
    const { videoId, title, author, duration, thumbnail } = req.body;
    const playlist = await Playlist.findOne({ _id: req.params.id, userId: req.userId });
    if (!playlist) return res.status(404).json({ success: false, message: 'Playlist not found' });

    // Duplicate check
    const exists = playlist.songs.find(s => s.videoId === videoId);
    if (exists) return res.json({ success: false, message: 'Song already in playlist' });

    playlist.songs.push({ videoId, title, author, duration, thumbnail });
    await playlist.save();
    logger.info(`Song added: ${title} → ${playlist.name}`, 'PLAYLIST');
    res.json({ success: true, playlist });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// Remove song
const removeSong = async (req, res) => {
  try {
    const playlist = await Playlist.findOne({ _id: req.params.id, userId: req.userId });
    if (!playlist) return res.status(404).json({ success: false, message: 'Playlist not found' });
    playlist.songs = playlist.songs.filter(s => s._id.toString() !== req.params.songId);
    await playlist.save();
    res.json({ success: true, playlist });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// Toggle favorite
const toggleFavorite = async (req, res) => {
  try {
    const playlist = await Playlist.findOne({ _id: req.params.id, userId: req.userId });
    if (!playlist) return res.status(404).json({ success: false, message: 'Playlist not found' });
    const song = playlist.songs.id(req.params.songId);
    if (song) { song.isFavorite = !song.isFavorite; await playlist.save(); }
    res.json({ success: true, playlist });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// Update playlist settings (shuffle, repeat, name)
const updatePlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: req.body },
      { new: true }
    );
    res.json({ success: true, playlist });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// Search YouTube for songs
const searchSongs = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ success: false, message: 'Query required' });
    const videos = await youtubeService.searchVideos(query, 6);
    res.json({ success: true, videos });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// AI: Auto-fill playlist based on mood/genre
const autoFill = async (req, res) => {
  try {
    const { playlistId, mood, genre, count = 5 } = req.body;
    const playlist = await Playlist.findOne({ _id: playlistId, userId: req.userId });
    if (!playlist) return res.status(404).json({ success: false, message: 'Playlist not found' });

    const query = mood ? `${mood} mood ${genre || 'music'} songs` : `${genre || 'popular'} songs 2024`;

    const videos = await youtubeService.searchVideos(query, count * 2);
    let added = 0;
    for (const v of videos) {
      if (added >= count) break;
      const exists = playlist.songs.find(s => s.videoId === v.videoId);
      if (!exists && v.videoId) {
        playlist.songs.push({ videoId: v.videoId, title: v.title, author: v.author, duration: v.duration, thumbnail: v.thumbnail });
        added++;
      }
    }
    await playlist.save();
    logger.info(`Auto-filled ${added} songs in ${playlist.name}`, 'PLAYLIST');
    res.json({ success: true, playlist, added });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// AI: Suggest songs for playlist
const suggestSongs = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const playlist = await Playlist.findOne({ _id: playlistId, userId: req.userId });
    if (!playlist) return res.status(404).json({ success: false, message: 'Playlist not found' });

    const existingSongs = playlist.songs.slice(0, 5).map(s => s.title).join(', ');
    const result = await groqService.chat([{
      role: 'user',
      content: `Playlist "${playlist.name}" mein yeh songs hain: ${existingSongs}. Is playlist ke liye 5 similar songs suggest karo. SIRF JSON return karo: [{"query": "search query for youtube"}, ...]`
    }]);

    const clean = result.content.replace(/```json|```/g, '').trim();
    const suggestions = JSON.parse(clean);

    const videos = [];
    for (const s of suggestions.slice(0, 5)) {
      try {
        const results = await youtubeService.searchVideos(s.query, 1);
        if (results[0]) videos.push(results[0]);
      } catch {}
    }

    res.json({ success: true, videos });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// Increment play count
const incrementPlay = async (req, res) => {
  try {
    const playlist = await Playlist.findOne({ _id: req.params.id, userId: req.userId });
    if (!playlist) return res.status(404).json({ success: false });
    const song = playlist.songs.id(req.params.songId);
    if (song) { song.playCount++; await playlist.save(); }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
};

module.exports = { getPlaylists, createPlaylist, deletePlaylist, addSong, removeSong, toggleFavorite, updatePlaylist, searchSongs, autoFill, suggestSongs, incrementPlay };
