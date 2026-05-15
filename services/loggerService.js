const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const formatLog = winston.format.printf(({ level, message, timestamp, logType }) => {
  const now = new Date(timestamp);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const type = logType || level.toUpperCase();
  return `[${level.toUpperCase()}][${year}/${month}/${date}][${hours}:${minutes}:${seconds}][${type}] ${message}`;
});

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    formatLog
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        formatLog
      )
    }),
    new winston.transports.File({
      filename: path.join(logsDir, `zoric-${new Date().toISOString().split('T')[0]}.log`),
      maxsize: 5242880,
      maxFiles: 10
    })
  ]
});

const log = {
  info: (message, logType = 'INFO') => logger.info({ message, logType }),
  warn: (message, logType = 'WARN') => logger.warn({ message, logType }),
  error: (message, logType = 'ERROR') => logger.error({ message, logType }),
  success: (message, logType = 'SUCCESS') => logger.info({ message, logType: `SUCCESS_${logType}` }),
};

module.exports = log;
