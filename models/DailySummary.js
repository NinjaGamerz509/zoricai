const mongoose = require('mongoose');

const dailySummarySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  summary: { type: String, required: true }, // AI generated summary
  stats: {
    totalMessages: { type: Number, default: 0 },
    tasksCompleted: { type: Number, default: 0 },
    songsPlayed: { type: Number, default: 0 },
    gymMentioned: { type: Boolean, default: false },
    mood: { type: String, default: 'neutral' }, // happy, sad, frustrated, neutral
    activeHours: [{ type: Number }], // which hours were active
    topTopics: [{ type: String }], // what was talked about
  },
  personalityInsights: { type: String, default: '' }, // what ZORIC learned about user today
  rawData: { type: String, default: '' }, // compressed conversation data
}, { timestamps: true });

module.exports = mongoose.model('DailySummary', dailySummarySchema);
