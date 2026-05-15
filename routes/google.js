const express = require('express');
const router = express.Router();
const g = require('../controllers/googleController');
const auth = require('../middleware/auth');

router.get('/auth', auth, g.getAuthUrl);
router.get('/callback', g.callback);
router.get('/emails', auth, g.getEmails);
router.post('/email/send', auth, g.sendEmail);
router.get('/calendar', auth, g.getCalendarEvents);
router.post('/calendar', auth, g.addCalendarEvent);
router.get('/drive', auth, g.getDriveFiles);

module.exports = router;
