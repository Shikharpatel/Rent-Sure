const Claim = require('../models/claimModel');
const Policy = require('../models/policyModel');
const Property = require('../models/propertyModel');
const User = require('../models/userModel');

// @desc    File a new claim against a policy
// @route   POST /api/claims
// @access  Private (Landlord only)
const fileClaim = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'landlord') {
            return res.status(403).json({ message: 'Access denied. Landlords only.' });
        }

        const { policy_id, description, evidence_url, claim_amount } = req.body;

        if (!policy_id || !description || !claim_amount) {
            return res.status(400).json({ message: 'Please provide policy_id, description, and claim_amount' });
        }

        // Verify the policy exists and is linked to the landlord's property
        const policy = await Policy.findById(policy_id);
        if (!policy) {
            return res.status(404).json({ message: 'Policy not found' });
        }

        const property = await Property.findById(policy.property_id);
        if (!property || property.owner_id !== req.user.id) {
            return res.status(403).json({ message: 'This policy is not linked to any of your properties' });
        }

        if (policy.status !== 'active') {
            return res.status(400).json({ message: 'Can only file claims against active policies' });
        }

        // Verify claim amount doesn't exceed coverage
        if (parseFloat(claim_amount) > parseFloat(policy.coverage_amount)) {
            return res.status(400).json({ message: 'Claim amount exceeds policy coverage of ' + policy.coverage_amount });
        }

        const claim = await Claim.create(policy_id, req.user.id, description, evidence_url, claim_amount);
        res.status(201).json(claim);
    } catch (error) {
        console.error('Error in fileClaim:', error);
        res.status(500).json({ message: 'Server error filing claim' });
    }
};

// @desc    Get claims filed by the logged-in landlord
// @route   GET /api/claims/me
// @access  Private (Landlord)
const getMyClaims = async (req, res) => {
    try {
        const claims = await Claim.findByLandlordId(req.user.id);
        res.status(200).json(claims);
    } catch (error) {
        console.error('Error in getMyClaims:', error);
        res.status(500).json({ message: 'Server error fetching claims' });
    }
};

// @desc    Get all pending claims (for admin review)
// @route   GET /api/claims/pending
// @access  Private (Admin only)
const getPendingClaims = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const claims = await Claim.findAllPending();
        res.status(200).json(claims);
    } catch (error) {
        console.error('Error in getPendingClaims:', error);
        res.status(500).json({ message: 'Server error fetching pending claims' });
    }
};

// @desc    Approve or reject a claim
// @route   PUT /api/claims/:id/review
// @access  Private (Admin only)
const reviewClaim = async (req, res) => {
    try {
        const { status } = req.body;

        if (!status || !['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Status must be "approved" or "rejected"' });
        }

        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const existingClaim = await Claim.findById(req.params.id);
        if (!existingClaim) {
            return res.status(404).json({ message: 'Claim not found' });
        }

        const updated = await Claim.updateStatus(req.params.id, status);
        res.status(200).json(updated);
    } catch (error) {
        console.error('Error in reviewClaim:', error);
        res.status(500).json({ message: 'Server error reviewing claim' });
    }
};

module.exports = {
    fileClaim,
    getMyClaims,
    getPendingClaims,
    reviewClaim,
};
