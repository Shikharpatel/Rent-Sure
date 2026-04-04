const express = require('express');
const router = express.Router();
const {
    getPolicyQuote,
    createPolicy,
    getMyPolicies,
    getLandlordPolicies,
    getPolicyById,
    getPolicyContract,
    activatePolicy,
} = require('../controllers/policyController');
const { protect } = require('../middleware/authMiddleware');

router.post('/quote', protect, getPolicyQuote);
router.post('/', protect, createPolicy);
router.get('/me', protect, getMyPolicies);
router.get('/landlord', protect, getLandlordPolicies);
router.get('/:id', protect, getPolicyById);
router.get('/:id/contract', protect, getPolicyContract);
router.put('/:id/activate', protect, activatePolicy);

module.exports = router;
