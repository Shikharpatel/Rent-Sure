/**
 * FraudDetector.js
 *
 * Purpose: Evaluates potentially fraudulent behaviors regarding a claim.
 * Role   : Passive observer. It exclusively scores risk levels but does NOT reject claims
 *          or modify financial payouts. Flags are routed to audit/human review.
 *
 * Canonical Output:
 * {
 *   fraud_score: number (0 - 100),
 *   risk_flag: string (low|medium|high),
 *   reasons: string[]
 * }
 */

// ─────────────────────────────────────────────────────────────────────────────
// Scoring Constants
// ─────────────────────────────────────────────────────────────────────────────

const SCORING = {
  EARLY_CLAIM: {
    threshold_days: 45,
    points: 35
  },
  OVER_CLAIMING_VALUE: {
    points: 40
  },
  HIGH_FREQUENCY: {
    points_per_prior_claim: 25
  },
  HIGH_VALUE_CLAIM: {
    threshold_pct_of_limit: 0.90, // Claim is >= 90% of max policy coverage
    points: 20
  }
};

const TIERS = {
  LOW_MAX: 30,
  MEDIUM_MAX: 70
};

// ─────────────────────────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assesses the fraud risk of a submitted claim.
 *
 * @param {object} inputs
 * @param {object} inputs.claim
 * @param {number} inputs.claim.claim_amount              - Requested INR
 * @param {number} inputs.claim.days_since_policy_start   - Integer days since inception
 * @param {number} inputs.claim.claim_frequency           - Number of prior claims on this policy
 * @param {number} inputs.claim.declared_asset_value      - Optional. Declared value of item at inception
 * @param {object} inputs.policy
 * @param {number} inputs.policy.coverage_limit           - Maximum policy payout limit
 *
 * @returns {object} Fraud evaluation result
 */
function detectFraud(inputs = {}) {
  const { claim = {}, policy = {} } = inputs;
  
  const claimAmount       = parseFloat(claim.claim_amount) || 0;
  const daysSinceStart    = parseInt(claim.days_since_policy_start); // Can be 0
  const priorClaims       = parseInt(claim.claim_frequency) || 0;
  const declaredAssetVal  = parseFloat(claim.declared_asset_value) || 0;
  
  const coverageLimit     = parseFloat(policy.coverage_limit) || 0;

  let rawScore = 0;
  const reasons = [];

  // 1. Early Claim (Ghosting/Pre-existing Damage Check)
  if (daysSinceStart !== undefined && !isNaN(daysSinceStart) && daysSinceStart <= SCORING.EARLY_CLAIM.threshold_days) {
    rawScore += SCORING.EARLY_CLAIM.points;
    reasons.push(
      `[EARLY CLAIM] Claim filed merely ${daysSinceStart} days after inception (<= ${SCORING.EARLY_CLAIM.threshold_days} day threshold). Added ${SCORING.EARLY_CLAIM.points} pts.`
    );
  }

  // 2. Over-Claiming (Assert Value Mismatch)
  if (declaredAssetVal > 0 && claimAmount > declaredAssetVal) {
    rawScore += SCORING.OVER_CLAIMING_VALUE.points;
    reasons.push(
      `[OVER-CLAIMING] Claim requested Rs.${claimAmount.toLocaleString()} but original declared asset value was only Rs.${declaredAssetVal.toLocaleString()}. Added ${SCORING.OVER_CLAIMING_VALUE.points} pts.`
    );
  }

  // 3. High Frequency (Pattern of Abuse)
  if (priorClaims > 0) {
    const freqScore = priorClaims * SCORING.HIGH_FREQUENCY.points_per_prior_claim;
    rawScore += freqScore;
    reasons.push(
      `[FREQUENCY] Tenant has filed ${priorClaims} prior claims. Added ${freqScore} pts (${SCORING.HIGH_FREQUENCY.points_per_prior_claim} per claim).`
    );
  }

  // 4. High Value Claim (Maxing Out Policy)
  if (coverageLimit > 0 && claimAmount > 0) {
    const ratio = claimAmount / coverageLimit;
    if (ratio >= SCORING.HIGH_VALUE_CLAIM.threshold_pct_of_limit) {
      rawScore += SCORING.HIGH_VALUE_CLAIM.points;
      reasons.push(
        `[HIGH VALUE] Claim of Rs.${claimAmount.toLocaleString()} is ${(ratio * 100).toFixed(1)}% of the absolute policy limit (Rs.${coverageLimit.toLocaleString()}). Added ${SCORING.HIGH_VALUE_CLAIM.points} pts.`
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Compilation & Tiering
  // ─────────────────────────────────────────────────────────────────────────────
  
  // Enforce mathematically strict bounds bounds [0 -> 100]
  const fraud_score = Math.min(Math.max(rawScore, 0), 100);
  
  let risk_flag = 'high';
  if (fraud_score <= TIERS.LOW_MAX) {
    risk_flag = 'low';
  } else if (fraud_score <= TIERS.MEDIUM_MAX) {
    risk_flag = 'medium';
  }

  if (risk_flag === 'low') {
    if (reasons.length === 0) {
      reasons.push('[CLEAN] No suspicious patterns detected.');
    } else {
      reasons.push('[OK] Minor signals triggered, but overall no suspicious patterns detected.');
    }
  }

  if (rawScore > 100) {
    reasons.push(`[NOTE] Unclamped raw mathematical score was ${rawScore}, hit ceiling of 100.`);
  }

  return {
    fraud_score,
    risk_flag,
    reasons
  };
}

module.exports = { detectFraud };
