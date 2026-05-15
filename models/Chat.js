const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['user', 'zoric'], required: true },
  message: { type: String, required: true },
  model: { type: String, default: 'llama-3.3-70b-versatile' },
  agentsUsed: { type: Number, default: 1 },
  responseTime: { type: Number },
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);
