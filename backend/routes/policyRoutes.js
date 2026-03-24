const express = require('express');
const router = express.Router();
const {
    getPolicyQuote,
    createPolicy,
    getMyPolicies,
    getLandlordPolicies,
    getPolicyById,
    activatePolicy,
} = require('../controllers/policyController');
const { protect } = require('../middleware/authMiddleware');

router.get('/quote/:propertyId', protect, getPolicyQuote);
router.post('/', protect, createPolicy);
router.get('/me', protect, getMyPolicies);
router.get('/landlord', protect, getLandlordPolicies);
router.get('/:id', protect, getPolicyById);
router.put('/:id/activate', protect, activatePolicy);

module.exports = router;
