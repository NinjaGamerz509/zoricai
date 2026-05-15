const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  category: { type: String, enum: ['today', 'upcoming', 'project'], default: 'today' },
  dueTime: { type: String },
  project: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
