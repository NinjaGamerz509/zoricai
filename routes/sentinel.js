const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  trackIp, lookupPhone, checkEmailBreach,
  searchUsername, findSubdomains, checkPhishing,
  analyzePassword, analyzeDomain
} = require('../controllers/sentinelController');

router.post('/ip', auth, trackIp);
router.post('/phone', auth, lookupPhone);
router.post('/email-breach', auth, checkEmailBreach);
router.post('/username', auth, searchUsername);
router.post('/subdomains', auth, findSubdomains);
router.post('/phishing', auth, checkPhishing);
router.post('/password', auth, analyzePassword);
router.post('/domain', auth, analyzeDomain);

module.exports = router;
