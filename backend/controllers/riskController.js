const RiskAssessment = require('../models/riskModel');
const KYC = require('../models/kycModel');
const User = require('../models/userModel');
const { assess } = require('../services/UnderwritingEngine');

// @desc    Generate a risk assessment for a tenant
// @route   POST /api/risk/assess
// @access  Private (Tenant only)
const assessRisk = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'tenant') {
            return res.status(403).json({ message: 'Access denied. Tenants only.' });
        }

        const kyc = await KYC.findByUserId(req.user.id);
        const { tenant_data = {} } = req.body;

        // Run UnderwritingEngine with available data.
        // rent_amount, city, furnishing_level are not known at standalone assessment time —
        // the engine handles each gracefully (conservative penalty for missing income ratio,
        // no penalty for missing city/furnishing).
        const result = assess({
            monthlyIncome: tenant_data.income || null,
            rentAmount: null,
            employmentStabilityMonths: tenant_data.employment_months || null,
            kycStatus: kyc?.status || 'pending',
            city: null,
            furnishingLevel: null,
            priorDefaults: 0
        });

        const assessment = await RiskAssessment.create(
            req.user.id,
            result.risk_score,
            result.risk_level
        );

        res.status(201).json({
            ...assessment,
            kyc_status: kyc ? kyc.status : 'not_submitted',
            reasoning: result.reasoning,
            probability_of_default: result.probability_of_default,
        });
    } catch (error) {
        console.error('Error in assessRisk:', error);
        res.status(500).json({ message: 'Server error during risk assessment' });
    }
};

// @desc    Get the latest risk assessment for the logged-in tenant
// @route   GET /api/risk/me
// @access  Private
const getMyRisk = async (req, res) => {
    try {
        const assessment = await RiskAssessment.findByTenantId(req.user.id);
        if (!assessment) {
            return res.status(404).json({ message: 'No risk assessment found. Please request one.' });
        }
        res.status(200).json(assessment);
    } catch (error) {
        console.error('Error in getMyRisk:', error);
        res.status(500).json({ message: 'Server error fetching risk assessment' });
    }
};

// @desc    Get risk assessment history
// @route   GET /api/risk/history
// @access  Private
const getRiskHistory = async (req, res) => {
    try {
        const assessments = await RiskAssessment.findAllByTenantId(req.user.id);
        res.status(200).json(assessments);
    } catch (error) {
        console.error('Error in getRiskHistory:', error);
        res.status(500).json({ message: 'Server error fetching risk history' });
    }
};

module.exports = {
    assessRisk,
    getMyRisk,
    getRiskHistory,
};
