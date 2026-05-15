const googleService = require('../services/googleService');
const User = require('../models/User');
const logger = require('../services/loggerService');

const getAuthUrl = (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(400).json({ success: false, message: 'Google not configured' });
    }
    const url = googleService.getAuthUrl();
    res.json({ success: true, url });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const callback = async (req, res) => {
  try {
    const { code } = req.query;
    const tokens = await googleService.getTokens(code);
    const users = await User.find();
    if (users.length > 0) {
      await User.findByIdAndUpdate(users[0]._id, { googleTokens: tokens });
    }
    logger.success('Google connected & saved', 'GOOGLE_AUTH');
    res.redirect('http://127.0.0.1:3000/settings?google=connected');
  } catch (error) {
    logger.error(`Google callback error: ${error.message}`, 'GOOGLE_ERROR');
    res.redirect('http://127.0.0.1:3000/settings?google=error');
  }
};

const getEmails = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user?.googleTokens) return res.status(400).json({ success: false, message: 'Google not connected' });
    const emails = await googleService.getEmails(user.googleTokens);
    res.json({ success: true, emails });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const sendEmail = async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    const user = await User.findById(req.userId);
    if (!user?.googleTokens) return res.status(400).json({ success: false, message: 'Google not connected' });
    await googleService.sendEmail(user.googleTokens, to, subject, body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getCalendarEvents = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user?.googleTokens) return res.status(400).json({ success: false, message: 'Google not connected' });
    const events = await googleService.getCalendarEvents(user.googleTokens);
    res.json({ success: true, events });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const addCalendarEvent = async (req, res) => {
  try {
    const { title, startTime, endTime, description } = req.body;
    const user = await User.findById(req.userId);
    if (!user?.googleTokens) return res.status(400).json({ success: false, message: 'Google not connected' });
    const event = await googleService.addCalendarEvent(user.googleTokens, title, startTime, endTime, description);
    res.json({ success: true, event });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getDriveFiles = async (req, res) => {
  try {
    const { q } = req.query;
    const user = await User.findById(req.userId);
    if (!user?.googleTokens) return res.status(400).json({ success: false, message: 'Google not connected' });
    const files = await googleService.getDriveFiles(user.googleTokens, 10, q);
    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAuthUrl, callback, getEmails, sendEmail, getCalendarEvents, addCalendarEvent, getDriveFiles };
