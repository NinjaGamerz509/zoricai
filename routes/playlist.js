const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getPlaylists, createPlaylist, deletePlaylist,
  addSong, removeSong, toggleFavorite,
  updatePlaylist, searchSongs, autoFill,
  suggestSongs, incrementPlay
} = require('../controllers/playlistController');

router.get('/', auth, getPlaylists);
router.post('/', auth, createPlaylist);
router.delete('/:id', auth, deletePlaylist);
router.patch('/:id', auth, updatePlaylist);
router.post('/:id/songs', auth, addSong);
router.delete('/:id/songs/:songId', auth, removeSong);
router.patch('/:id/songs/:songId/favorite', auth, toggleFavorite);
router.patch('/:id/songs/:songId/play', auth, incrementPlay);
router.get('/search', auth, searchSongs);
router.post('/autofill', auth, autoFill);
router.get('/:id/suggest', auth, suggestSongs);

module.exports = router;
