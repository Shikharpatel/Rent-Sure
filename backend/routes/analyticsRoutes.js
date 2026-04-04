const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// @desc    Calculate total loss ratio (Total Claims Paid / Total Premium Collected)
// @route   GET /api/analytics/loss-ratio
// @access  Private (Admin)
router.get('/loss-ratio', async (req, res) => {
    try {
        const query = `
            SELECT 
                (SELECT COALESCE(SUM(calculated_payout), 0) 
     FROM Claims 
     WHERE status = 'approved') AS total_claims_paid,

    (SELECT COALESCE(SUM(premium_amount), 0) 
     FROM Policies 
     WHERE status IN ('active', 'expired', 'under_review')) AS total_premium_collected
        `;
        const result = await pool.query(query);
        const { total_claims_paid, total_premium_collected } = result.rows[0];

        const paid = parseFloat(total_claims_paid);
        const collected = parseFloat(total_premium_collected);
        const loss_ratio = collected > 0 ? (paid / collected).toFixed(4) : 0;

        res.status(200).json({
            data: {
                loss_ratio: parseFloat(loss_ratio),
                total_claims_paid: paid,
                total_premium_collected: collected
            },
            meta: { description: 'System-wide loss ratio calculation.' }
        });
    } catch (error) {
        console.error('Error fetching loss ratio:', error);
        res.status(500).json({ error: 'Failed to fetch loss ratio', code: 'ANALYTICS_ERROR' });
    }
});

// @desc    Get distribution of claims by fraud risk
// @route   GET /api/analytics/fraud-distribution
// @access  Private (Admin)
router.get('/fraud-distribution', async (req, res) => {
    try {
        // Fraud bands strictly replicate the engine rules (LOW < 30, MEDIUM < 70, HIGH >= 70)
        const query = `
            SELECT 
                CASE 
                    WHEN fraud_score <= 30 THEN 'LOW'
                    WHEN fraud_score < 70 THEN 'MEDIUM'
                    ELSE 'HIGH'
                END as risk_flag,
                COUNT(*) as claim_count
            FROM Claims
            GROUP BY 
                CASE 
                    WHEN fraud_score <= 30 THEN 'LOW'
                    WHEN fraud_score < 70 THEN 'MEDIUM'
                    ELSE 'HIGH'
                END;
        `;
        const result = await pool.query(query);

        res.status(200).json({
            data: result.rows.map(r => ({
                risk_flag: r.risk_flag,
                count: parseInt(r.claim_count)
            })),
            meta: { description: 'Claims grouped by assigned fraud score bands.' }
        });
    } catch (error) {
        console.error('Error fetching fraud distribution:', error);
        res.status(500).json({ error: 'Failed to fetch fraud distribution', code: 'ANALYTICS_ERROR' });
    }
});

// @desc    Get distribution of claims by tenant risk level
// @route   GET /api/analytics/risk-segmentation
// @access  Private (Admin)
router.get('/risk-segmentation', async (req, res) => {
    try {
        const query = `
            SELECT 
                ra.risk_level, 
                COUNT(c.claim_id) as claim_count
            FROM Claims c
            JOIN Policies p ON c.policy_id = p.policy_id
            JOIN Risk_Assessments ra ON p.tenant_id = ra.tenant_id
            GROUP BY ra.risk_level;
        `;
        const result = await pool.query(query);

        res.status(200).json({
            data: result.rows.map(r => ({
                risk_level: r.risk_level || 'UNKNOWN',
                count: parseInt(r.claim_count)
            })),
            meta: { description: 'Claims grouped by the tenant base underwriting risk level.' }
        });
    } catch (error) {
        console.error('Error fetching risk segmentation:', error);
        res.status(500).json({ error: 'Failed to fetch risk segmentation', code: 'ANALYTICS_ERROR' });
    }
});

// @desc    Get distribution of claims by policy coverage type
// @route   GET /api/analytics/coverage-performance
// @access  Private (Admin)
router.get('/coverage-performance', async (req, res) => {
    try {
        // We aggregate against the policy's root coverage_type field
        const query = `
            SELECT 
                p.coverage_type, 
                COUNT(c.claim_id) as claim_count
            FROM Claims c
            JOIN Policies p ON c.policy_id = p.policy_id
            GROUP BY p.coverage_type;
        `;
        const result = await pool.query(query);

        res.status(200).json({
            data: result.rows.map(r => ({
                coverage_type: r.coverage_type || 'UNKNOWN',
                count: parseInt(r.claim_count)
            })),
            meta: { description: 'Claims volume grouped by the parent policy coverage tier.' }
        });
    } catch (error) {
        console.error('Error fetching coverage performance:', error);
        res.status(500).json({ error: 'Failed to fetch coverage performance', code: 'ANALYTICS_ERROR' });
    }
});

module.exports = router;
