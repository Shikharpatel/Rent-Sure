const Policy = require('../models/policyModel');
const Property = require('../models/propertyModel');
const User = require('../models/userModel');
const KYC = require('../models/kycModel');
const Risk = require('../models/riskModel');
const { pool } = require('../config/db');

const { assess } = require('../services/UnderwritingEngine');
const { price } = require('../services/PricingEngine');
const { attemptTransition } = require('../services/LifecycleStateMachine');
const { generateContractHTML } = require('../utils/DocumentGenerator');

// @desc    Get an enterprise engine quote for a property
// @route   POST /api/policies/quote
// @access  Private (Tenant only)
const getPolicyQuote = async (req, res) => {
    try {
        const { tenant_data = {}, property_data = {}, coverages = {}, add_ons = {} } = req.body;

        // Validation for coverage limit
        const allowedLimits = [100000, 300000, 500000];
        const requestedLimit = Number(coverages.damage_cover_limit || 500000);
        
        if (!allowedLimits.includes(requestedLimit)) {
            return res.status(400).json({ 
                error: "Invalid coverage limit. Must be one of: ₹1,00,000, ₹3,00,000, or ₹5,00,000.", 
                code: "INVALID_COVERAGE_LIMIT" 
            });
        }

        const safeCoverages = {
            damage_cover_limit: requestedLimit,
            rent_default_months: Number(coverages.rent_default_months || 2),
            deductible: Number(coverages.deductible || 10000)
        };

        // 0. Resolve Property ID and Fetch from DB (Trust Source)
        const propertyId = req.body.property_id || property_data.property_id || property_data.id;
        if (!propertyId) {
            return res.status(400).json({ error: "Invalid property reference", code: "INVALID_PROPERTY_ID" });
        }

        const property = await Property.findById(propertyId);
        if (!property) {
            return res.status(404).json({ error: "Property not found in database", code: "PROPERTY_NOT_FOUND" });
        }

        const safeProperty = {
            rent_amount: property.rent_amount,
            city: property.city,
            furnishing_level: property.furnishing_level
        };

        // 1. Fetch actual KYC status from DB (Truth Source)
        const kycRecord = await KYC.findByUserId(req.user.id);
        const kycStatus = kycRecord?.status || 'pending';

        // 2. Run Underwriting (Risk Assessment)
        const underwritingResult = assess({
            monthlyIncome: tenant_data.income,
            rentAmount: safeProperty.rent_amount,
            employmentStabilityMonths: tenant_data.employment_months,
            kycStatus: kycStatus,
            city: safeProperty.city,
            furnishingLevel: safeProperty.furnishing_level,
            priorDefaults: tenant_data.prior_defaults || 0
        });

        // 3. Run Pricing
        const pricingResult = price({
            underwriting: underwritingResult,
            property: safeProperty,
            coverages: safeCoverages,
            addOns: add_ons
        });

        res.status(200).json({
            risk_details: {
                level: underwritingResult.risk_level,
                score: underwritingResult.risk_score,
                probability_of_default: underwritingResult.probability_of_default
            },
            pricing: {
                final_premium: pricingResult.final_premium,
                breakdown: pricingResult.metadata.stages,
                summary: pricingResult.explainability_summary,
                cap_applied: pricingResult.metadata.cap_applied
            },
            explainability: {
                underwriting_reasons: underwritingResult.reasoning,
                pricing_reasons: pricingResult.reasoning
            }
        });
    } catch (error) {
        console.error('Error generating quote:', error);
        res.status(500).json({ message: 'Error generating quote across engines' });
    }
};

// @desc    Orchestrate policy creation via State Machine & Engines
// @route   POST /api/policies
// @access  Private (Tenant only)
const createPolicy = async (req, res) => {
    try {
        const { tenant_data = {}, property_data = {}, coverages = {}, add_ons = {} } = req.body;
        
        // Validation for coverage limit
        const allowedLimits = [100000, 300000, 500000];
        const requestedLimit = Number(coverages.damage_cover_limit || 500000);
        
        if (!allowedLimits.includes(requestedLimit)) {
            return res.status(400).json({ 
                error: "Invalid coverage limit. Must be one of: ₹1,00,000, ₹3,00,000, or ₹5,00,000.", 
                code: "INVALID_COVERAGE_LIMIT" 
            });
        }

        const safeCoverages = {
            damage_cover_limit: requestedLimit,
            rent_default_months: Number(coverages.rent_default_months || 2),
            deductible: Number(coverages.deductible || 10000)
        };

        // 0. Resolve Property ID strictly and Fetch from DB (Truth Source)
        const propertyId = req.body.property_id || property_data.property_id || property_data.id;
        if (!propertyId) {
            return res.status(400).json({ 
                error: "Invalid property reference. Please select a valid property.", 
                code: "INVALID_PROPERTY_ID" 
            });
        }

        const property = await Property.findById(propertyId);
        if (!property) {
            return res.status(404).json({ error: "Property not found in database", code: "PROPERTY_NOT_FOUND" });
        }

        const safeProperty = {
            rent_amount: property.rent_amount,
            city: property.city,
            furnishing_level: property.furnishing_level
        };

        // 1. Core Engines
        // Fetch actual KYC status from DB (Truth Source)
        const kycRecord = await KYC.findByUserId(req.user.id);
        const kycStatus = kycRecord?.status || 'pending';

        const underwritingResult = assess({
            monthlyIncome: tenant_data.income,
            rentAmount: safeProperty.rent_amount,
            employmentStabilityMonths: tenant_data.employment_months,
            kycStatus: kycStatus,
            city: safeProperty.city,
            furnishingLevel: safeProperty.furnishing_level,
            priorDefaults: tenant_data.prior_defaults || 0
        });

        const pricingResult = price({
            underwriting: underwritingResult,
            property: safeProperty,
            coverages: safeCoverages,
            addOns: add_ons
        });

        // 2. Lifecycle State Machine
        // Initial logical state is strictly 'draft'
        const initialState = 'draft';
        
        // Trigger the engine to explicitly move this contract to 'under_review' safely
        const transition = attemptTransition({
            entity_type: 'policy',
            current_state: initialState,
            action: 'submit' // Action maps draft -> under_review
        });

        if (!transition.success) {
            return res.status(400).json({ error: transition.error, code: 'STATE_TRANSITION_FAILED' });
        }

        const client = await pool.connect();
        let dbPolicyId, dbVersion, dbCreatedAt;

        try {
            await client.query('BEGIN');

            // Serialize Engine Decisions (Fallback to TEXT column as JSON string since no JSONB columns exist)
            const serializedDecisions = JSON.stringify({
                risk_score: underwritingResult.risk_score,
                risk_level: underwritingResult.risk_level,
                probability_of_default: underwritingResult.probability_of_default,
                pricing_breakdown: pricingResult.metadata.stages,
                reasoning: pricingResult.reasoning
            });

            // Resolve dates: use tenant-submitted dates, fall back to today / +1 year
            const startDate  = req.body.start_date  || new Date().toISOString().split('T')[0];
            const expiryDate = req.body.expiry_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            // Insert Policy root
            const polRes = await client.query(`
                INSERT INTO Policies (tenant_id, property_id, premium_amount, coverage_amount, start_date, expiry_date, version_num, status, policy_document_url)
                VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8)
                RETURNING policy_id, version_num, created_at;
            `, [
                req.user ? req.user.id : null, // Uses auth middleware context
                propertyId,
                pricingResult.final_premium,
                safeCoverages.damage_cover_limit, // Consistent with PricingEngine usage
                startDate,
                expiryDate,
                transition.next_state,
                serializedDecisions // Persisting strictly required analytic data
            ]);

            dbPolicyId = polRes.rows[0].policy_id;
            dbVersion = polRes.rows[0].version_num;
            dbCreatedAt = polRes.rows[0].created_at;

            // Optional: Map coverages to table
            if (safeCoverages.damage_cover_limit > 0) {
                await client.query(`
                    INSERT INTO Coverages (policy_id, coverage_type, trigger_condition, payout_limit)
                    VALUES ($1, 'property_damage', 'physical_damage_proven', $2)
                `, [dbPolicyId, safeCoverages.damage_cover_limit]);
            }

            // Optional: Map assets to table
            if (add_ons.asset_declarations && Array.isArray(add_ons.asset_declarations)) {
                for (const asset of add_ons.asset_declarations) {
                    await client.query(`
                        INSERT INTO Asset_Declarations (policy_id, description, declared_value, condition_status)
                        VALUES ($1, $2, $3, $4)
                    `, [dbPolicyId, asset.description, asset.declared_value, asset.condition || 'good']);
                }
            }

            await client.query('COMMIT');
        } catch (dbErr) {
            await client.query('ROLLBACK');
            console.error("--- DB TRANSACTION FAILURE ---");
            console.error("CODE:", dbErr.code);
            console.error("MESSAGE:", dbErr.message);
            console.error("DETAIL:", dbErr.detail);
            console.error("STACK:", dbErr.stack);

            return res.status(500).json({ 
                error: dbErr.message, 
                code: dbErr.code, 
                detail: dbErr.detail,
                hint: dbErr.hint
            });
        } finally {
            client.release();
        }

        // 4. Assemble Immutable Output Payload
        const policyAssembly = {
            policy_id: dbPolicyId,
            version_num: dbVersion,
            created_at: dbCreatedAt,
            policy_summary: {
                property_city: property_data.city,
                coverages_selected: coverages,
                add_ons_selected: add_ons,
                deductible: coverages.deductible || 0
            },
            risk_details: {
                level: underwritingResult.risk_level,
                score: underwritingResult.risk_score
            },
            pricing_details: {
                final_monthly_premium: pricingResult.final_premium,
                base: pricingResult.base_premium,
                risk_loaded: pricingResult.risk_loaded_premium,
                explainability_summary: pricingResult.explainability_summary
            },
            state: {
                initial: initialState,
                current: transition.next_state,
                state_reasoning: transition.reasoning
            }
        };

        res.status(201).json(policyAssembly);
    } catch (error) {
        console.error('Error orchestrating policy creation:', error);
        res.status(500).json({ error: 'Server error creating policy via Engines.', code: 'INTERNAL_ERROR' });
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

// @desc    Get Policy Contract HTML
// @route   GET /api/policies/:id/contract
// @access  Private (Tenant/Landlord/Admin)
const getPolicyContract = async (req, res) => {
    try {
        // Find policy by params
        const policy = await Policy.findById(req.params.id);
        if (!policy) {
            return res.status(404).json({ message: 'Policy not found' });
        }
        
        // Use generator. In a real system, we re-query Risk/Coverages or just map existing flat fields.
        const html = generateContractHTML({
            policy_id: policy.policy_id,
            tenant_details: { name: policy.tenant_name },
            property_details: {
                city: policy.property_city,
                rent_amount: policy.property_rent_amount || 0
            },
            pricing_details: {
                base: policy.premium_amount * 0.8,
                final_monthly_premium: policy.premium_amount
            },
            coverages: {
                damage_cover_limit: policy.coverage_amount
            }
        });

        res.status(200).send(html);
    } catch (error) {
        console.error('Error generating contract:', error);
        res.status(500).json({ message: 'Server error generating contract' });
    }
};

module.exports = {
    getPolicyQuote,
    createPolicy,
    getMyPolicies,
    getLandlordPolicies,
    getPolicyById,
    getPolicyContract,
    activatePolicy,
};
