const RiskAssessment = require('../models/riskModel');
const KYC = require('../models/kycModel');
const User = require('../models/userModel');

// Simulated risk scoring algorithm
function calculateRisk(kycData) {
    // In a real system, this would use credit scores, rental history, etc.
    // For simulation, we generate a score based on simple heuristics
    let score = Math.floor(Math.random() * 100) + 1; // 1–100

    // If KYC is approved, lower the risk slightly
    if (kycData && kycData.status === 'approved') {
        score = Math.max(1, score - 15);
    }

    let level;
    if (score <= 33) {
        level = 'low';
    } else if (score <= 66) {
        level = 'medium';
    } else {
        level = 'high';
    }

    return { score, level };
}

// @desc    Generate a risk assessment for a tenant
// @route   POST /api/risk/assess
// @access  Private (Tenant only)
const assessRisk = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'tenant') {
            return res.status(403).json({ message: 'Access denied. Tenants only.' });
        }

        // Check KYC status
        const kyc = await KYC.findByUserId(req.user.id);

        const { score, level } = calculateRisk(kyc);
        const assessment = await RiskAssessment.create(req.user.id, score, level);

        res.status(201).json({
            ...assessment,
            kyc_status: kyc ? kyc.status : 'not_submitted',
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
