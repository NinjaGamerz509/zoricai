const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { fetchPage, analyzeText } = require('../controllers/browserController');

router.post('/fetch', auth, fetchPage);
router.post('/analyze', auth, analyzeText);

module.exports = router;
