const express = require('express');
const router = express.Router();
const {
    submitKYC,
    getMyKYC,
    getPendingKYC,
    reviewKYC,
} = require('../controllers/kycController');
const { protect } = require('../middleware/authMiddleware');

// All KYC routes are protected
router.post('/', protect, submitKYC);
router.get('/me', protect, getMyKYC);
router.get('/pending', protect, getPendingKYC);
router.put('/:kycId/review', protect, reviewKYC);

module.exports = router;
