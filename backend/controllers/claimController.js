const Claim = require('../models/claimModel');
const Policy = require('../models/policyModel');
const Property = require('../models/propertyModel');
const User = require('../models/userModel');
const { pool } = require('../config/db');

const { validateClaim } = require('../services/CoverageBehaviorEngine');
const { adjudicate } = require('../services/ClaimsAdjudicator');
const { detectFraud } = require('../services/FraudDetector');
const { attemptTransition } = require('../services/LifecycleStateMachine');
// @desc    Orchestrate claim filing via Engines & State Machine
// @route   POST /api/claims
// @access  Private (Landlord only)
const fileClaim = async (req, res) => {
    try {
        const { claim_data = {}, policy_data = {} } = req.body;
        
        // 1. Validation Engine (Behavior)
        // Resolve claim_type from damage_classification if not explicitly provided
        const resolvedClaimType = claim_data.claim_type ||
            (claim_data.damage_classification ? 'property_damage' : 'rent_default');

        // Compute days_since_policy_start from actual policy start_date in DB
        let daysSincePolicyStart = claim_data.days_since_policy_start || 0;
        if (!daysSincePolicyStart && policy_data.policy_id) {
            try {
                const polRow = await pool.query('SELECT start_date FROM Policies WHERE policy_id = $1', [policy_data.policy_id]);
                if (polRow.rows[0]?.start_date) {
                    const startMs = new Date(polRow.rows[0].start_date).getTime();
                    daysSincePolicyStart = Math.floor((Date.now() - startMs) / 86400000);
                }
            } catch (_) { /* non-critical */ }
        }

        // Normalize coverages to match engine expectations
        const normalizedCoverages = (policy_data.coverages || []).map(c =>
            c === 'property_damage' ? 'property_damage' : c
        );

        const validationResult = validateClaim({
            claim: { ...claim_data, claim_type: resolvedClaimType, days_since_policy_start: daysSincePolicyStart },
            policy: { ...policy_data, coverages: normalizedCoverages, waiting_period: 0 }
        });

        // 2. Adjudication Engine (Payout Math)
        const adjudicationResult = adjudicate({
            claim: claim_data,
            policy: policy_data,
            validation_result: validationResult
        });

        // 3. Fraud Detection Engine (Warning system)
        const evidenceCount = Array.isArray(claim_data.evidence_urls)
            ? claim_data.evidence_urls.filter(u => u && u.trim()).length
            : (claim_data.evidence_url ? 1 : 0);

        // Look up prior claim count for this landlord from DB (never trust frontend)
        let priorClaimCount = 0;
        try {
            const priorRow = await pool.query(
                'SELECT COUNT(*) AS cnt FROM Claims WHERE landlord_id = $1',
                [req.user.id]
            );
            priorClaimCount = parseInt(priorRow.rows[0]?.cnt || 0);
        } catch (_) { /* non-critical */ }

        const fraudResult = detectFraud({
            claim: {
                ...claim_data,
                days_since_policy_start: daysSincePolicyStart,
                evidence_count: evidenceCount,
                claim_frequency: priorClaimCount
            },
            policy: policy_data
        });

        // 4. Lifecycle State Machine
        let currentState = 'filed';
        
        // Step 1: Attempt 'validate' transition
        const valTransition = attemptTransition({
            entity_type: 'claim',
            current_state: currentState,
            action: validationResult.is_valid ? 'validate' : 'reject_early'
        });
        
        if (!valTransition.success) {
            return res.status(400).json({ error: valTransition.error, code: 'CLAIM_INVALID' });
        }
        currentState = valTransition.next_state; // 'validated' or 'rejected'

        // Step 2: Attempt 'review' transition if we made it to 'validated'
        let finalTransition = valTransition;
        if (currentState === 'validated') {
            finalTransition = attemptTransition({
                entity_type: 'claim',
                current_state: currentState,
                action: 'review'
            });
            if (finalTransition.success) {
                currentState = finalTransition.next_state;
            }
        }

        // 5. Database Persistence (Strict Transaction)
        const client = await pool.connect();
        let dbClaimId, dbCreatedAt;

        try {
            await client.query('BEGIN');

            const landlordId = req.user ? req.user.id : null;
            const linkedPolicyId = policy_data.policy_id || null;

            // Integrity Check: Foreign Key Policy existence && active status
            if (linkedPolicyId) {
                const polCheck = await client.query('SELECT policy_id, status FROM Policies WHERE policy_id = $1', [linkedPolicyId]);
                if (polCheck.rows.length === 0) {
                    const integrityError = new Error(`Referential Integrity Failed: Policy ID ${linkedPolicyId} not found in database.`);
                    integrityError.type = 'POLICY_NOT_FOUND';
                    throw integrityError;
                }
                if (polCheck.rows[0].status !== 'active') {
                    const statusError = new Error(`Claims can only be filed against active policies. Current status is ${polCheck.rows[0].status}.`);
                    statusError.type = 'POLICY_NOT_ACTIVE';
                    throw statusError;
                }
            }

            // Normalization: Ensure cleanly stringified JSON for arrays to prevent database corruption
            const reasonText = adjudicationResult.reasoning 
                ? JSON.stringify(adjudicationResult.reasoning) 
                : '[]';

            // Normalise evidence URLs: accept array or fallback to single URL string
            const evidenceUrls = Array.isArray(claim_data.evidence_urls) && claim_data.evidence_urls.length > 0
                ? claim_data.evidence_urls.filter(u => u && u.trim())
                : (claim_data.evidence_url ? [claim_data.evidence_url] : []);

            const claimQuery = `
                INSERT INTO Claims (
                    policy_id, landlord_id, description, claim_amount,
                    damage_classification, calculated_payout, fraud_score,
                    adjudication_reasoning, status, evidence_urls
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING claim_id, created_at;
            `;

            const dbRes = await client.query(claimQuery, [
                linkedPolicyId,
                landlordId,
                claim_data.description || 'System Orchestrated Claim',
                claim_data.claim_amount || 0,
                claim_data.damage_classification || null,
                adjudicationResult.calculated_payout || 0,
                fraudResult.fraud_score || 0,
                reasonText,
                currentState,
                evidenceUrls   // pg driver sends JS arrays as PostgreSQL TEXT[]
            ]);

            dbClaimId = dbRes.rows[0].claim_id;
            dbCreatedAt = dbRes.rows[0].created_at;

            await client.query('COMMIT');
        } catch (dbErr) {
            await client.query('ROLLBACK');
            if (dbErr.type === 'POLICY_NOT_FOUND') {
                return res.status(404).json({ error: dbErr.message, code: 'POLICY_NOT_FOUND' });
            }
            if (dbErr.type === 'POLICY_NOT_ACTIVE') {
                return res.status(400).json({ error: dbErr.message, code: 'POLICY_NOT_ACTIVE' });
            }
            if (dbErr.code === '23503') {
                return res.status(400).json({ error: 'Database constraint failed on foreign key map.', code: 'DB_CONSTRAINT_FAILED' });
            }
            return res.status(500).json({ error: 'Database transaction aborted.', code: 'INTERNAL_ERROR' });
        } finally {
            client.release();
        }

        // 6. Assemble Immutable Output Payload
        const claimAssembly = {
            claim_id: dbClaimId,
            created_at: dbCreatedAt,
            validation_result: {
                is_valid: validationResult.is_valid,
                summary: validationResult.validation_summary,
                rejection_reasons: validationResult.rejection_reasons
            },
            adjudication_result: {
                approved: adjudicationResult.approved,
                calculated_payout: adjudicationResult.calculated_payout,
                breakdown: adjudicationResult.breakdown,
                reasoning: adjudicationResult.reasoning
            },
            fraud_analysis: {
                score: fraudResult.fraud_score,
                risk_flag: fraudResult.risk_flag,
                reasons: fraudResult.reasons
            },
            state: {
                initial: 'filed',
                current: currentState,
                state_reasoning: finalTransition.reasoning
            }
        };

        res.status(201).json(claimAssembly);
    } catch (error) {
        console.error('Error orchestrating claim filing:', error);
        res.status(500).json({ error: 'Server error filing claim via Engines.', code: 'INTERNAL_ERROR' });
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
