const Policy = require('../models/policyModel');
const Property = require('../models/propertyModel');
const User = require('../models/userModel');
const KYC = require('../models/kycModel');
const Risk = require('../models/riskModel');

// Helper to calculate algorithmic premium
const calculateQuote = (deposit, riskScore) => {
    const coverage = parseFloat(deposit);
    const baseRate = coverage * 0.015; // 1.5% base
    let multiplier = 1.5; // High risk default
    if (riskScore >= 90) multiplier = 1.0;
    else if (riskScore >= 70) multiplier = 1.2;
    
    return {
        coverage_amount: coverage,
        premium_amount: Math.round(baseRate * multiplier)
    };
};

// @desc    Get an algorithmic quote for a property
// @route   GET /api/policies/quote/:propertyId
// @access  Private (Tenant only)
const getPolicyQuote = async (req, res) => {
    try {
        const property = await Property.findById(req.params.propertyId);
        if (!property) return res.status(404).json({ message: 'Property not found' });
        
        const risk = await Risk.findByUserId(req.user.id);
        if (!risk) return res.status(400).json({ message: 'Risk assessment required to generate quote' });
        
        const quote = calculateQuote(property.estimated_deposit, risk.risk_score);
        res.status(200).json(quote);
    } catch (error) {
        console.error('Error generating quote:', error);
        res.status(500).json({ message: 'Error generating quote' });
    }
};

// @desc    Purchase a new protection policy
// @route   POST /api/policies
// @access  Private (Tenant only)
const createPolicy = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'tenant') {
            return res.status(403).json({ message: 'Access denied. Tenants only.' });
        }

        const kyc = await KYC.findByUserId(req.user.id);
        if (!kyc || kyc.status !== 'approved') {
            return res.status(400).json({ message: 'KYC must be approved before purchasing a policy.' });
        }

        const { property_id, start_date, expiry_date, coverage_type } = req.body;
        if (!property_id || !start_date || !expiry_date) {
            return res.status(400).json({ message: 'Please provide property_id, start_date, and expiry_date' });
        }

        // Verify property exists
        const property = await Property.findById(property_id);
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        // Double-insurance check
        const activePolicy = await Policy.findActiveByPropertyId(property_id);
        if (activePolicy) {
            return res.status(400).json({ message: 'This property already has an active protection policy.' });
        }

        const risk = await Risk.findByUserId(req.user.id);
        if (!risk) return res.status(400).json({ message: 'Risk assessment required' });

        // Algorithmic pricing!
        const quote = calculateQuote(property.estimated_deposit, risk.risk_score);

        const policy = await Policy.create(
            req.user.id, property_id, quote.premium_amount, quote.coverage_amount,
            start_date, expiry_date, coverage_type || 'combined'
        );

        res.status(201).json(policy);
    } catch (error) {
        console.error('Error in createPolicy:', error);
        res.status(500).json({ message: 'Server error creating policy' });
    }
};

// @desc    Get logged-in tenant's policies
// @route   GET /api/policies/me
// @access  Private
const getMyPolicies = async (req, res) => {
    try {
        const policies = await Policy.findByTenantId(req.user.id);
        res.status(200).json(policies);
    } catch (error) {
        console.error('Error in getMyPolicies:', error);
        res.status(500).json({ message: 'Server error fetching policies' });
    }
};

// @desc    Get policies for a landlord's properties
// @route   GET /api/policies/landlord
// @access  Private (Landlord only)
const getLandlordPolicies = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'landlord') {
            return res.status(403).json({ message: 'Access denied. Landlords only.' });
        }

        const policies = await Policy.findByLandlordId(req.user.id);
        res.status(200).json(policies);
    } catch (error) {
        console.error('Error in getLandlordPolicies:', error);
        res.status(500).json({ message: 'Server error fetching landlord policies' });
    }
};

// @desc    Get a single policy by ID
// @route   GET /api/policies/:id
// @access  Private
const getPolicyById = async (req, res) => {
    try {
        const policy = await Policy.findById(req.params.id);
        if (!policy) {
            return res.status(404).json({ message: 'Policy not found' });
        }
        res.status(200).json(policy);
    } catch (error) {
        console.error('Error in getPolicyById:', error);
        res.status(500).json({ message: 'Server error fetching policy' });
    }
};

// @desc    Activate a policy (Admin)
// @route   PUT /api/policies/:id/activate
// @access  Private (Admin only)
const activatePolicy = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const policy = await Policy.findById(req.params.id);
        if (!policy) {
            return res.status(404).json({ message: 'Policy not found' });
        }

        const updated = await Policy.updateStatus(req.params.id, 'active');
        res.status(200).json(updated);
    } catch (error) {
        console.error('Error in activatePolicy:', error);
        res.status(500).json({ message: 'Server error activating policy' });
    }
};

module.exports = {
    getPolicyQuote,
    createPolicy,
    getMyPolicies,
    getLandlordPolicies,
    getPolicyById,
    activatePolicy,
};
