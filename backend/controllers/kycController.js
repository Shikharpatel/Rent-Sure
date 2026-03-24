const KYC = require('../models/kycModel');
const User = require('../models/userModel');

// @desc    Submit KYC details
// @route   POST /api/kyc
// @access  Private (Tenant)
const submitKYC = async (req, res) => {
    try {
        const { pan_number, id_document_url, address } = req.body;

        if (!pan_number || !id_document_url || !address) {
            return res.status(400).json({ message: 'Please provide PAN number, ID document URL, and address' });
        }

        // Check if user already has a KYC record
        const existingKYC = await KYC.findByUserId(req.user.id);
        if (existingKYC) {
            return res.status(400).json({ message: 'KYC already submitted. Current status: ' + existingKYC.status });
        }

        const kyc = await KYC.create(req.user.id, pan_number, id_document_url, address);
        res.status(201).json(kyc);
    } catch (error) {
        console.error('Error in submitKYC:', error);
        // Handle unique constraint violation for PAN number
        if (error.code === '23505') {
            return res.status(400).json({ message: 'PAN number already registered' });
        }
        res.status(500).json({ message: 'Server error during KYC submission' });
    }
};

// @desc    Get logged-in user's KYC status
// @route   GET /api/kyc/me
// @access  Private
const getMyKYC = async (req, res) => {
    try {
        const kyc = await KYC.findByUserId(req.user.id);

        if (!kyc) {
            return res.status(404).json({ message: 'No KYC record found. Please submit your KYC.' });
        }

        res.status(200).json(kyc);
    } catch (error) {
        console.error('Error in getMyKYC:', error);
        res.status(500).json({ message: 'Server error fetching KYC' });
    }
};

// @desc    Get all pending KYC submissions (admin view)
// @route   GET /api/kyc/pending
// @access  Private (Admin only)
const getPendingKYC = async (req, res) => {
    try {
        // Verify user is an admin
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const pendingList = await KYC.findAllPending();
        res.status(200).json(pendingList);
    } catch (error) {
        console.error('Error in getPendingKYC:', error);
        res.status(500).json({ message: 'Server error fetching pending KYC records' });
    }
};

// @desc    Approve or reject a KYC record
// @route   PUT /api/kyc/:kycId/review
// @access  Private (Admin only)
const reviewKYC = async (req, res) => {
    try {
        const { kycId } = req.params;
        const { status } = req.body;

        // Validate status value
        if (!status || !['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Status must be "approved" or "rejected"' });
        }

        // Verify user is an admin
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        // Check if KYC record exists
        const existingKYC = await KYC.findById(kycId);
        if (!existingKYC) {
            return res.status(404).json({ message: 'KYC record not found' });
        }

        const updatedKYC = await KYC.updateStatus(kycId, status, req.user.id);
        res.status(200).json(updatedKYC);
    } catch (error) {
        console.error('Error in reviewKYC:', error);
        res.status(500).json({ message: 'Server error reviewing KYC' });
    }
};

module.exports = {
    submitKYC,
    getMyKYC,
    getPendingKYC,
    reviewKYC,
};
