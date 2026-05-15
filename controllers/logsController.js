const fs = require('fs');
const path = require('path');
const logger = require('../services/loggerService');

const getLogs = async (req, res) => {
  try {
    const { type, date, search, limit = 200 } = req.query;
    const logsDir = path.join(__dirname, '../logs');
    const logDate = date || new Date().toISOString().split('T')[0];
    const logFile = path.join(logsDir, `zoric-${logDate}.log`);

    if (!fs.existsSync(logFile)) {
      return res.json({ success: true, logs: [], stats: { total: 0, errors: 0, warnings: 0, success: 0 } });
    }

    const content = fs.readFileSync(logFile, 'utf-8');
    let lines = content.split('\n').filter(Boolean);

    if (type && type !== 'ALL') {
      lines = lines.filter(l => l.includes(`[${type}]`));
    }
    if (search) {
      lines = lines.filter(l => l.toLowerCase().includes(search.toLowerCase()));
    }

    lines = lines.slice(-parseInt(limit));

    const stats = {
      total: lines.length,
      errors: lines.filter(l => l.includes('[ERROR]')).length,
      warnings: lines.filter(l => l.includes('[WARN]')).length,
      success: lines.filter(l => l.includes('[SUCCESS]') || l.includes('SUCCESS')).length
    };

    const parsedLogs = lines.map((line, i) => ({
      id: i,
      raw: line,
      level: line.includes('[ERROR]') ? 'ERROR' : line.includes('[WARN]') ? 'WARN' : line.includes('SUCCESS') ? 'SUCCESS' : 'INFO'
    }));

    res.json({ success: true, logs: parsedLogs.reverse(), stats });
  } catch (error) {
    logger.error(`Logs fetch error: ${error.message}`, 'LOGS_ERROR');
    res.status(500).json({ success: false, message: error.message });
  }
};

const getLogDates = async (req, res) => {
  try {
    const logsDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logsDir)) return res.json({ success: true, dates: [] });
    const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
    const dates = files.map(f => f.replace('zoric-', '').replace('.log', '')).sort().reverse();
    res.json({ success: true, dates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getLogs, getLogDates };
