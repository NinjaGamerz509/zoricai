const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  level: { type: String, enum: ['INFO', 'WARN', 'ERROR', 'SUCCESS'], required: true },
  logType: { type: String, required: true },
  message: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Log', logSchema);
