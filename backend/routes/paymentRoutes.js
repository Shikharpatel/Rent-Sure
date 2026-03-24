const express = require('express');
const router = express.Router();
const {
    makePayment,
    getPaymentsByPolicy,
    getMyPayments,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, makePayment);
router.get('/me', protect, getMyPayments);
router.get('/policy/:policyId', protect, getPaymentsByPolicy);

module.exports = router;
