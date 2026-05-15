const express = require('express');
const router = express.Router();
const { getLogs, getLogDates } = require('../controllers/logsController');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, getLogs);
router.get('/dates', authMiddleware, getLogDates);

module.exports = router;
