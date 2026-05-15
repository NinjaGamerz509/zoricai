const mongoose = require('mongoose');

// YouTube Watch History
const youtubeHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  videoId: { type: String, required: true },
  title: { type: String, required: true },
  author: { type: String },
  thumbnail: { type: String },
  url: { type: String },
  duration: { type: String },
  watchedAt: { type: Date, default: Date.now },
  liked: { type: Boolean, default: false }
});

// Journal
const journalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, default: '' },
  content: { type: String, required: true },
  mood: { type: String, enum: ['happy', 'sad', 'neutral', 'excited', 'angry', 'anxious'], default: 'neutral' },
  tags: [{ type: String }]
}, { timestamps: true });

// Habit
const habitSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  frequency: { type: String, enum: ['daily', 'weekly'], default: 'daily' },
  streak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  completedDates: [{ type: String }],
  color: { type: String, default: '#00d4ff' },
  icon: { type: String, default: '⭐' }
}, { timestamps: true });

// Expense
const expenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  category: { type: String, enum: ['food', 'transport', 'entertainment', 'shopping', 'health', 'education', 'other'], default: 'other' },
  description: { type: String, default: '' },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

// Mood Tracker
const moodSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mood: { type: String, enum: ['happy', 'sad', 'neutral', 'excited', 'angry', 'anxious'], required: true },
  note: { type: String, default: '' },
  date: { type: String, required: true }
}, { timestamps: true });

// Secure Notes
const secureNoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  encrypted: { type: Boolean, default: true }
}, { timestamps: true });

// Pomodoro Sessions
const pomodoroSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  duration: { type: Number, default: 25 },
  completed: { type: Boolean, default: false },
  topic: { type: String, default: '' }
}, { timestamps: true });

module.exports = {
  YoutubeHistory: mongoose.model('YoutubeHistory', youtubeHistorySchema),
  Journal: mongoose.model('Journal', journalSchema),
  Habit: mongoose.model('Habit', habitSchema),
  Expense: mongoose.model('Expense', expenseSchema),
  Mood: mongoose.model('Mood', moodSchema),
  SecureNote: mongoose.model('SecureNote', secureNoteSchema),
  Pomodoro: mongoose.model('Pomodoro', pomodoroSchema)
};
