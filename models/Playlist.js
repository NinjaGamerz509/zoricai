const mongoose = require('mongoose');

const songSchema = new mongoose.Schema({
  videoId: { type: String, required: true },
  title: { type: String, required: true },
  author: { type: String, default: 'Unknown' },
  duration: { type: String, default: '' },
  thumbnail: { type: String, default: '' },
  addedAt: { type: Date, default: Date.now },
  playCount: { type: Number, default: 0 },
  isFavorite: { type: Boolean, default: false },
});

const playlistSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  tags: [{ type: String }], // #chill #workout #focus
  songs: [songSchema],
  mood: { type: String, default: '' }, // happy, sad, energetic, chill
  isDefault: { type: Boolean, default: false },
  shuffle: { type: Boolean, default: false },
  repeat: { type: String, enum: ['none', 'one', 'all'], default: 'none' },
  currentIndex: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Playlist', playlistSchema);
