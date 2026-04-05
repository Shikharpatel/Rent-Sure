const express = require('express');
const router = express.Router();
const { getPendingPolicies, reviewPolicy, getPendingClaims, reviewClaim } = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');

// Ensure only admin can access
const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admin only.' });
    }
};

router.use(protect);
router.use(adminOnly);

router.get('/policies/pending', getPendingPolicies);
router.post('/policies/:id/review', reviewPolicy);

router.get('/claims/pending', getPendingClaims);
router.post('/claims/:id/review', reviewClaim);

module.exports = router;
