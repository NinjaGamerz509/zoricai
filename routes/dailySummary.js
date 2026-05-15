const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { generateSummaryApi, getProfileApi, getProactiveApi, getSummariesApi } = require('../controllers/dailySummaryController');

router.post('/generate', auth, generateSummaryApi);
router.get('/profile', auth, getProfileApi);
router.get('/proactive', auth, getProactiveApi);
router.get('/', auth, getSummariesApi);

module.exports = router;
