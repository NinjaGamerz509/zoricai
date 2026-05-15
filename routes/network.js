const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { scanNetwork } = require('../controllers/networkController');
router.get('/scan', auth, scanNetwork);
module.exports = router;
