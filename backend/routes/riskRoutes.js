const express = require('express');
const router = express.Router();
const {
    assessRisk,
    getMyRisk,
    getRiskHistory,
} = require('../controllers/riskController');
const { protect } = require('../middleware/authMiddleware');

router.post('/assess', protect, assessRisk);
router.get('/me', protect, getMyRisk);
router.get('/history', protect, getRiskHistory);

module.exports = router;
