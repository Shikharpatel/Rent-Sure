/**
 * ClaimsAdjudicator.js
 *
 * Purpose: Mathematically calculates the final financial payout for a claim.
 * Role   : Deterministic calculator. Operates EXCLUSIVELY after CoverageBehaviorEngine.
 *
 * Adjudication Waterfall:
 *  1. Validation Gate → Must be `is_valid: true`.
 *  2. Base Claim      → Raw requested amount.
 *  3. Depreciation    → Calculate asset value loss over time (if applicable).
 *  4. Deductible      → Tenant risk-sharing layer subtracted.
 *  5. Limit Cap       → Hard ceiling applied based on policy Coverage Limit.
 *
 * Canonical Output:
 * {
 *   approved: boolean,
 *   calculated_payout: number,
 *   actual_loss: number,             // The original claim amount
 *   payable_loss: number,            // The eligible amount after depreciation
 *   zero_payout_reason: string|null, // Explains exactly why payout hit 0
 *   breakdown: object,
 *   reasoning: string[]
 * }
 */

// ─────────────────────────────────────────────────────────────────────────────
// Adjudication Rules Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_DEPRECIATION_PCT = 0.75; // Maximum 75% drop in value regardless of age
const DEPRECIATION_PER_MONTH = 0.015; // 1.5% monthly depreciation (18% Annual)

// ─────────────────────────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adjudicates the final claim payout amount.
 *
 * @param {object} inputs
 * @param {object} inputs.claim                    - Core claim details
 * @param {number} inputs.claim.claim_amount       - Requested INR
 * @param {number} inputs.claim.asset_age_months   - Optional. Age of item if physical asset
 * @param {object} inputs.claim.asset              - Optional. Extensible asset struct (replaces flat age)
 * @param {number} inputs.claim.asset.age_months   - Overrides flat asset_age_months if present
 * @param {object} inputs.policy                   - Policy math contracts
 * @param {number} inputs.policy.coverage_limit    - Maximum limit in INR
 * @param {number} inputs.policy.deductible        - Deductible to subtract locally
 * @param {object} inputs.validation_result        - Output from CoverageBehaviorEngine
 * @param {boolean} inputs.validation_result.is_valid
 * @param {string[]} inputs.validation_result.rejection_reasons
 *
 * @returns {object} Adjudication result
 */
function adjudicate(inputs = {}) {
  const {
    claim = {},
    policy = {},
    validation_result = { is_valid: false, rejection_reasons: ['Validation payload missing'] }
  } = inputs;

  const claimAmount   = parseFloat(claim.claim_amount) || 0;
  
  // Future-proofing: Read from nested asset object if present, fallback to flat parameter
  const asset         = claim.asset || {};
  const assetAge      = parseInt(asset.age_months) || parseInt(claim.asset_age_months) || 0;
  
  const coverageLimit = parseFloat(policy.coverage_limit) || 0;
  const deductible    = parseFloat(policy.deductible) || 0;

  const reasoning = [];
  const breakdown = {
    starting_amount: claimAmount,
    depreciation_deduction: 0,
    post_depreciation: claimAmount,
    deductible_deduction: 0,
    post_deductible: claimAmount,
    limit_cap_reduction: 0,
    final_payout: 0,
  };

  let zero_payout_reason = null;

  // 1. Validation Gate
  if (!validation_result.is_valid) {
    reasoning.push('[ADJUDICATION FAILED] Claim rejected by Behavior Validation layer.');
    reasoning.push(...(validation_result.rejection_reasons || []));
    zero_payout_reason = 'Failed validation rules (see rejection reasons)';
    
    return {
      approved: false,
      calculated_payout: 0,
      actual_loss: claimAmount,
      payable_loss: 0,
      zero_payout_reason,
      breakdown,
      reasoning
    };
  }

  reasoning.push(`[START] Claim validated. Evaluating payout for Rs.${claimAmount.toLocaleString()}`);

  // 2 & 3. Base Amount & Depreciation
  if (assetAge > 0) {
    let rawDepPct = assetAge * DEPRECIATION_PER_MONTH;
    let actualDepPct = Math.min(rawDepPct, MAX_DEPRECIATION_PCT);
    
    breakdown.depreciation_deduction = Math.round(claimAmount * actualDepPct);
    breakdown.post_depreciation = Math.round(claimAmount - breakdown.depreciation_deduction);

    reasoning.push(
      `[DEPRECIATION] Asset age ${assetAge} months → ${(actualDepPct * 100).toFixed(1)}% depreciation applied. Value reduced by Rs.${breakdown.depreciation_deduction.toLocaleString()} to Rs.${breakdown.post_depreciation.toLocaleString()}`
    );
  }

  // 4. Deductible Application
  let currentVal = breakdown.post_depreciation;
  if (deductible > 0 && currentVal > 0) {
    breakdown.deductible_deduction = Math.min(currentVal, deductible);
    currentVal = currentVal - breakdown.deductible_deduction;
    breakdown.post_deductible = currentVal;

    reasoning.push(
      `[DEDUCTIBLE] Policy deductible of Rs.${deductible.toLocaleString()} subtracted. Remaining eligible value: Rs.${currentVal.toLocaleString()}`
    );
  }

  // FLOOR PROTECTION: Explicitly ensure we never drop below 0
  if (currentVal <= 0) {
    currentVal = 0;
    if (breakdown.deductible_deduction > 0) {
      zero_payout_reason = 'Claim fully absorbed by tenant deductible';
      reasoning.push('[FLOOR applied] Eligible value fell to 0 after deductible. No payout possible.');
    } else if (breakdown.depreciation_deduction >= claimAmount) {
      zero_payout_reason = 'Asset fully depreciated to 0 value';
      reasoning.push('[FLOOR applied] Eligible value fell to 0 due to heavy depreciation. No payout possible.');
    }
  }

  // 5. Coverage Cap Application
  let finalPayout = currentVal;
  if (finalPayout > coverageLimit) {
    breakdown.limit_cap_reduction = finalPayout - coverageLimit;
    finalPayout = coverageLimit;
    
    reasoning.push(
      `[CAP] Eligible value (Rs.${currentVal.toLocaleString()}) exceeds policy coverage limit of Rs.${coverageLimit.toLocaleString()}. Capped at limit.`
    );
  } else {
    reasoning.push(`[LIMIT] Eligible value is within the policy coverage limit of Rs.${coverageLimit.toLocaleString()}.`);
  }

  breakdown.final_payout = finalPayout;

  const approved = finalPayout > 0;
  if (approved) {
    reasoning.push(`[APPROVAL] Final calculated payout approved for Rs.${finalPayout.toLocaleString()}`);
  } else {
    reasoning.push(`[DENIAL] Math resolved to Rs.0 payout.`);
    // Fallback zero reason if it wasn't caught specifically by floor checks
    if (!zero_payout_reason) zero_payout_reason = 'Calculations resulted in zero eligible payout';
  }

  return {
    approved,
    calculated_payout: finalPayout,
    actual_loss: claimAmount,
    payable_loss: breakdown.post_depreciation,
    zero_payout_reason,
    breakdown,
    reasoning
  };
}

module.exports = { adjudicate };
