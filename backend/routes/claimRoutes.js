const express = require('express');
const router = express.Router();
const {
    fileClaim,
    getMyClaims,
    getPendingClaims,
    reviewClaim,
} = require('../controllers/claimController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, fileClaim);
router.get('/me', protect, getMyClaims);
router.get('/pending', protect, getPendingClaims);
router.put('/:id/review', protect, reviewClaim);

module.exports = router;
