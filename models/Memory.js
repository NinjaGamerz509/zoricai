const mongoose = require('mongoose');

const memorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  key: { type: String, required: true },
  value: { type: String, required: true },
  category: { type: String, default: 'general' }
}, { timestamps: true });

module.exports = mongoose.model('Memory', memorySchema);
