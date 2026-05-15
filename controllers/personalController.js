const { Journal, Habit, Expense, Mood, SecureNote, Pomodoro } = require('../models/NewModels');
const logger = require('../services/loggerService');
const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'zoric_default_key';

// ==================== JOURNAL ====================
const getJournals = async (req, res) => {
  try {
    const journals = await Journal.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(30);
    res.json({ success: true, journals });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const createJournal = async (req, res) => {
  try {
    const { title, content, mood, tags } = req.body;
    const journal = await Journal.create({ userId: req.userId, title, content, mood, tags });
    logger.info('Journal entry created', 'JOURNAL');
    res.status(201).json({ success: true, journal });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const deleteJournal = async (req, res) => {
  try {
    await Journal.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// ==================== HABITS ====================
const getHabits = async (req, res) => {
  try {
    const habits = await Habit.find({ userId: req.userId });
    res.json({ success: true, habits });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const createHabit = async (req, res) => {
  try {
    const { name, description, frequency, color, icon } = req.body;
    const habit = await Habit.create({ userId: req.userId, name, description, frequency, color, icon });
    res.status(201).json({ success: true, habit });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const completeHabit = async (req, res) => {
  try {
    const habit = await Habit.findOne({ _id: req.params.id, userId: req.userId });
    if (!habit) return res.status(404).json({ success: false, message: 'Habit not found' });
    const today = new Date().toISOString().split('T')[0];
    if (!habit.completedDates.includes(today)) {
      habit.completedDates.push(today);
      habit.streak += 1;
      if (habit.streak > habit.longestStreak) habit.longestStreak = habit.streak;
    }
    await habit.save();
    res.json({ success: true, habit });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const deleteHabit = async (req, res) => {
  try {
    await Habit.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// ==================== EXPENSES ====================
const getExpenses = async (req, res) => {
  try {
    const { month, year } = req.query;
    const filter = { userId: req.userId };
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      filter.date = { $gte: start, $lte: end };
    }
    const expenses = await Expense.find(filter).sort({ date: -1 });
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    res.json({ success: true, expenses, total });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const addExpense = async (req, res) => {
  try {
    const { amount, category, description, date } = req.body;
    const expense = await Expense.create({ userId: req.userId, amount, category, description, date });
    logger.info(`Expense added: ${amount} - ${category}`, 'EXPENSE');
    res.status(201).json({ success: true, expense });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const deleteExpense = async (req, res) => {
  try {
    await Expense.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getExpenseStats = async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.userId });
    const byCategory = {};
    expenses.forEach(e => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    });
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    res.json({ success: true, byCategory, total, count: expenses.length });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// ==================== MOOD ====================
const getMoods = async (req, res) => {
  try {
    const moods = await Mood.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(30);
    res.json({ success: true, moods });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const logMood = async (req, res) => {
  try {
    const { mood, note } = req.body;
    const date = new Date().toISOString().split('T')[0];
    const existing = await Mood.findOneAndUpdate(
      { userId: req.userId, date },
      { mood, note },
      { upsert: true, new: true }
    );
    res.json({ success: true, mood: existing });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// ==================== SECURE NOTES ====================
const getNotes = async (req, res) => {
  try {
    const notes = await SecureNote.find({ userId: req.userId }).select('-content').sort({ createdAt: -1 });
    res.json({ success: true, notes });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const createNote = async (req, res) => {
  try {
    const { title, content } = req.body;
    const encrypted = CryptoJS.AES.encrypt(content, ENCRYPTION_KEY).toString();
    const note = await SecureNote.create({ userId: req.userId, title, content: encrypted });
    res.status(201).json({ success: true, note: { ...note.toObject(), content: undefined } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getNote = async (req, res) => {
  try {
    const note = await SecureNote.findOne({ _id: req.params.id, userId: req.userId });
    if (!note) return res.status(404).json({ success: false, message: 'Note not found' });
    const decrypted = CryptoJS.AES.decrypt(note.content, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
    res.json({ success: true, note: { ...note.toObject(), content: decrypted } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const deleteNote = async (req, res) => {
  try {
    await SecureNote.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// ==================== POMODORO ====================
const startPomodoro = async (req, res) => {
  try {
    const { duration = 25, topic = '' } = req.body;
    const session = await Pomodoro.create({ userId: req.userId, duration, topic });
    res.status(201).json({ success: true, session });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const completePomodoro = async (req, res) => {
  try {
    const session = await Pomodoro.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { completed: true },
      { new: true }
    );
    res.json({ success: true, session });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

module.exports = {
  getJournals, createJournal, deleteJournal,
  getHabits, createHabit, completeHabit, deleteHabit,
  getExpenses, addExpense, deleteExpense, getExpenseStats,
  getMoods, logMood,
  getNotes, createNote, getNote, deleteNote,
  startPomodoro, completePomodoro
};
