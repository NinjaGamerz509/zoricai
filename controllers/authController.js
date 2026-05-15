const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../services/loggerService');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }
    const user = await User.create({ email, password, name: name || 'Boss' });
    const token = generateToken(user._id);
    logger.success(`User registered: ${email}`, 'USER_REGISTER');
    res.status(201).json({ success: true, token, user: { id: user._id, email: user.email, name: user.name } });
  } catch (error) {
    logger.error(`Register error: ${error.message}`, 'AUTH_ERROR');
    res.status(500).json({ success: false, message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      logger.warn(`Failed login attempt: ${email}`, 'LOGIN_FAIL');
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const token = generateToken(user._id);
    logger.info(`User logged in: ${email}`, 'USER_LOGIN');
    res.json({ success: true, token, user: { id: user._id, email: user.email, name: user.name, preferences: user.preferences } });
  } catch (error) {
    logger.error(`Login error: ${error.message}`, 'AUTH_ERROR');
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { register, login, getMe };
