const Policy = require('../models/policyModel');
const Claim = require('../models/claimModel');
const { attemptTransition } = require('../services/LifecycleStateMachine');

// @desc    Get all policies awaiting review
// @route   GET /api/admin/policies/pending
// @access  Private (Admin)
const getPendingPolicies = async (req, res) => {
    try {
        const policies = await Policy.findAllPending();
        res.status(200).json(policies);
    } catch (error) {
        console.error('Error fetching pending policies:', error);
        res.status(500).json({ message: 'Server error fetching pending policies' });
    }
};

// @desc    Approve or reject a policy
// @route   POST /api/admin/policies/:id/review
// @access  Private (Admin)
const reviewPolicy = async (req, res) => {
    try {
        const { action } = req.body; // 'approve' or 'reject'
        const policyId = req.params.id;

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ message: 'Action must be approve or reject' });
        }

        const policy = await Policy.findById(policyId);
        if (!policy) return res.status(404).json({ message: 'Policy not found' });

        const transition = attemptTransition({
            entity_type: 'policy',
            current_state: policy.status,
            action: action
        });

        if (!transition.success) {
            return res.status(400).json({ message: transition.error });
        }

        const updated = await Policy.updateStatus(policyId, transition.next_state);
        res.status(200).json(updated);
    } catch (error) {
        console.error('Error reviewing policy:', error);
        res.status(500).json({ message: 'Server error updating policy status' });
    }
};

// @desc    Get all claims awaiting review
// @route   GET /api/admin/claims/pending
// @access  Private (Admin)
const getPendingClaims = async (req, res) => {
    try {
        const claims = await Claim.findAllPending();
        res.status(200).json(claims);
    } catch (error) {
        console.error('Error fetching pending claims:', error);
        res.status(500).json({ message: 'Server error fetching pending claims' });
    }
};

// @desc    Approve or reject a claim
// @route   POST /api/admin/claims/:id/review
// @access  Private (Admin)
const reviewClaim = async (req, res) => {
    try {
        const { action } = req.body; // 'approve' or 'reject'
        const claimId = req.params.id;

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ message: 'Action must be approve or reject' });
        }

        const claim = await Claim.findById(claimId);
        if (!claim) return res.status(404).json({ message: 'Claim not found' });

        const transition = attemptTransition({
            entity_type: 'claim',
            current_state: claim.status,
            action: action
        });

        if (!transition.success) {
            return res.status(400).json({ message: transition.error });
        }

        const updated = await Claim.updateStatus(claimId, transition.next_state);
        res.status(200).json(updated);
    } catch (error) {
        console.error('Error reviewing claim:', error);
        res.status(500).json({ message: 'Server error updating claim status' });
    }
};

module.exports = {
    getPendingPolicies,
    reviewPolicy,
    getPendingClaims,
    reviewClaim
};
