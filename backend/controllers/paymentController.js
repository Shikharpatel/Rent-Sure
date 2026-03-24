const Payment = require('../models/paymentModel');
const Policy = require('../models/policyModel');
const User = require('../models/userModel');

// @desc    Make a premium payment for a policy
// @route   POST /api/payments
// @access  Private (Tenant only)
const makePayment = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'tenant') {
            return res.status(403).json({ message: 'Access denied. Tenants only.' });
        }

        const { policy_id, amount } = req.body;

        if (!policy_id || !amount) {
            return res.status(400).json({ message: 'Please provide policy_id and amount' });
        }

        // Verify policy exists and belongs to this tenant
        const policy = await Policy.findById(policy_id);
        if (!policy) {
            return res.status(404).json({ message: 'Policy not found' });
        }
        if (policy.tenant_id !== req.user.id) {
            return res.status(403).json({ message: 'This policy does not belong to you' });
        }
        if (policy.status !== 'active') {
            return res.status(400).json({ message: 'Policy is not active. Current status: ' + policy.status });
        }

        // Simulate payment (always succeeds)
        const payment = await Payment.create(policy_id, req.user.id, amount);
        res.status(201).json(payment);
    } catch (error) {
        console.error('Error in makePayment:', error);
        res.status(500).json({ message: 'Server error processing payment' });
    }
};

// @desc    Get payment history for a specific policy
// @route   GET /api/payments/policy/:policyId
// @access  Private
const getPaymentsByPolicy = async (req, res) => {
    try {
        const payments = await Payment.findByPolicyId(req.params.policyId);
        const total = await Payment.getTotalByPolicyId(req.params.policyId);
        res.status(200).json({ payments, total_paid: total });
    } catch (error) {
        console.error('Error in getPaymentsByPolicy:', error);
        res.status(500).json({ message: 'Server error fetching payments' });
    }
};

// @desc    Get all payments made by the logged-in tenant
// @route   GET /api/payments/me
// @access  Private
const getMyPayments = async (req, res) => {
    try {
        const payments = await Payment.findByTenantId(req.user.id);
        res.status(200).json(payments);
    } catch (error) {
        console.error('Error in getMyPayments:', error);
        res.status(500).json({ message: 'Server error fetching payments' });
    }
};

module.exports = {
    makePayment,
    getPaymentsByPolicy,
    getMyPayments,
};
