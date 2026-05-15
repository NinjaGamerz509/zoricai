const express = require('express');
const router = express.Router();
const p = require('../controllers/personalController');
const auth = require('../middleware/auth');

// Journal
router.get('/journal', auth, p.getJournals);
router.post('/journal', auth, p.createJournal);
router.delete('/journal/:id', auth, p.deleteJournal);

// Habits
router.get('/habits', auth, p.getHabits);
router.post('/habits', auth, p.createHabit);
router.put('/habits/:id/complete', auth, p.completeHabit);
router.delete('/habits/:id', auth, p.deleteHabit);

// Expenses
router.get('/expenses', auth, p.getExpenses);
router.post('/expenses', auth, p.addExpense);
router.delete('/expenses/:id', auth, p.deleteExpense);
router.get('/expenses/stats', auth, p.getExpenseStats);

// Mood
router.get('/mood', auth, p.getMoods);
router.post('/mood', auth, p.logMood);

// Secure Notes
router.get('/notes', auth, p.getNotes);
router.post('/notes', auth, p.createNote);
router.get('/notes/:id', auth, p.getNote);
router.delete('/notes/:id', auth, p.deleteNote);

// Pomodoro
router.post('/pomodoro', auth, p.startPomodoro);
router.put('/pomodoro/:id/complete', auth, p.completePomodoro);

module.exports = router;
