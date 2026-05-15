const jwt = require('jsonwebtoken');
const logger = require('../services/loggerService');

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      logger.warn('No token provided', 'AUTH_FAIL');
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    logger.error(`Invalid token: ${error.message}`, 'AUTH_ERROR');
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

module.exports = authMiddleware;
