const express = require('express');
const router = express.Router();
const {
    createProperty,
    getMyProperties,
    getPropertyByInviteCode,
    getPropertyById,
    updateProperty,
    regenerateInviteCode,
    deleteProperty,
} = require('../controllers/propertyController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createProperty);
router.post('/:id/regenerate-invite', protect, regenerateInviteCode);
router.get('/invite/:code', protect, getPropertyByInviteCode);
router.get('/mine', protect, getMyProperties);
router.get('/:id', protect, getPropertyById);
router.put('/:id', protect, updateProperty);
router.delete('/:id', protect, deleteProperty);

module.exports = router;
