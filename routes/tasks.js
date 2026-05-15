const express = require('express');
const router = express.Router();
const { getTasks, createTask, updateTask, deleteTask, getStats } = require('../controllers/taskController');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, getTasks);
router.post('/', authMiddleware, createTask);
router.put('/:id', authMiddleware, updateTask);
router.delete('/:id', authMiddleware, deleteTask);
router.get('/stats', authMiddleware, getStats);

module.exports = router;
