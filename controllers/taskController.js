const Task = require('../models/Task');
const logger = require('../services/loggerService');

const getTasks = async (req, res) => {
  try {
    const { category, status } = req.query;
    const filter = { userId: req.userId };
    if (category) filter.category = category;
    if (status) filter.status = status;
    const tasks = await Task.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createTask = async (req, res) => {
  try {
    const { title, description, priority, category, dueTime, project } = req.body;
    const task = await Task.create({ userId: req.userId, title, description, priority, category, dueTime, project });
    logger.info(`Task created: ${title}`, 'TASK_CREATE');
    res.status(201).json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateTask = async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true }
    );
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    logger.info(`Task updated: ${task.title}`, 'TASK_UPDATE');
    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteTask = async (req, res) => {
  try {
    await Task.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    logger.info('Task deleted', 'TASK_DELETE');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getStats = async (req, res) => {
  try {
    const total = await Task.countDocuments({ userId: req.userId });
    const completed = await Task.countDocuments({ userId: req.userId, status: 'completed' });
    const pending = await Task.countDocuments({ userId: req.userId, status: 'pending' });
    res.json({ success: true, stats: { total, completed, pending } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getTasks, createTask, updateTask, deleteTask, getStats };
