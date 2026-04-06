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
// Scoring Constants — multiplier-based model
//
// Score = BASE × (product of all triggered signal multipliers), clamped [0,100]
// Signals compound: two medium signals together produce a high-risk score.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_SCORE = 20;

// Multipliers > 1 raise the score (red flags).
// Multipliers < 1 lower the score (trust signals).
// All signals compound: score = BASE × M1 × M2 × ... clamped to [0, 100].
const MULTIPLIERS = {
  // ── Red flags ────────────────────────────────────────────────────────────
  NO_EVIDENCE: {
    value: 2.2           // Heaviest — no proof submitted at all
  },
  EARLY_CLAIM: {
    value: 1.8,          // Claimed very soon after inception
    threshold_days: 45
  },
  OVER_CLAIMING_VALUE: {
    value: 1.7           // Amount exceeds declared asset value
  },
  HIGH_FREQUENCY: {
    value: 1.4           // Per prior claim (compounds for repeat filers)
  },
  HIGH_VALUE_CLAIM: {
    value: 1.3,          // Claim is >= 90% of coverage limit
    threshold_pct_of_limit: 0.90
  },
  // ── Trust signals ────────────────────────────────────────────────────────
  STRONG_EVIDENCE: {
    value: 0.5,          // 3+ supporting items — well-documented claim
    threshold_count: 3
  },
  SOME_EVIDENCE: {
    value: 0.7,          // 1–2 items — partially documented
    threshold_count: 1
  },
  MATURE_POLICY: {
    value: 0.7,          // Policy held >180 days before claiming
    threshold_days: 180
  },
  LOW_VALUE_CLAIM: {
    value: 0.8,          // Claim is <30% of coverage limit — not trying to max out
    threshold_pct_of_limit: 0.30
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
  const evidenceCount     = parseInt(claim.evidence_count) || 0;

  const coverageLimit     = parseFloat(policy.coverage_limit) || 0;

  let score = BASE_SCORE;
  const reasons = [];

  // ── Red flags (score × multiplier > 1) ───────────────────────────────────

  // 1. No Evidence Submitted (heaviest red flag)
  if (evidenceCount === 0) {
    score *= MULTIPLIERS.NO_EVIDENCE.value;
    reasons.push(
      `[NO EVIDENCE] No supporting photos or documents submitted. ×${MULTIPLIERS.NO_EVIDENCE.value} applied.`
    );
  }

  // 2. Early Claim
  if (!isNaN(daysSinceStart) && daysSinceStart <= MULTIPLIERS.EARLY_CLAIM.threshold_days) {
    score *= MULTIPLIERS.EARLY_CLAIM.value;
    reasons.push(
      `[EARLY CLAIM] Filed ${daysSinceStart} day(s) after inception (<= ${MULTIPLIERS.EARLY_CLAIM.threshold_days} day threshold). ×${MULTIPLIERS.EARLY_CLAIM.value} applied.`
    );
  }

  // 3. Over-Claiming (amount exceeds declared asset value)
  if (declaredAssetVal > 0 && claimAmount > declaredAssetVal) {
    score *= MULTIPLIERS.OVER_CLAIMING_VALUE.value;
    reasons.push(
      `[OVER-CLAIMING] Claimed Rs.${claimAmount.toLocaleString()} exceeds declared asset value of Rs.${declaredAssetVal.toLocaleString()}. ×${MULTIPLIERS.OVER_CLAIMING_VALUE.value} applied.`
    );
  }

  // 4. High Frequency (multiplier stacks per prior claim)
  if (priorClaims > 0) {
    for (let i = 0; i < priorClaims; i++) {
      score *= MULTIPLIERS.HIGH_FREQUENCY.value;
    }
    reasons.push(
      `[FREQUENCY] ${priorClaims} prior claim(s) on record. ×${MULTIPLIERS.HIGH_FREQUENCY.value} applied ${priorClaims} time(s).`
    );
  }

  // 5. High Value Claim (≥90% of coverage limit)
  if (coverageLimit > 0 && claimAmount > 0) {
    const ratio = claimAmount / coverageLimit;
    if (ratio >= MULTIPLIERS.HIGH_VALUE_CLAIM.threshold_pct_of_limit) {
      score *= MULTIPLIERS.HIGH_VALUE_CLAIM.value;
      reasons.push(
        `[HIGH VALUE] Rs.${claimAmount.toLocaleString()} is ${(ratio * 100).toFixed(1)}% of policy limit. ×${MULTIPLIERS.HIGH_VALUE_CLAIM.value} applied.`
      );
    }
  }

  // ── Trust signals (score × multiplier < 1) ───────────────────────────────

  // 6. Evidence quality
  if (evidenceCount >= MULTIPLIERS.STRONG_EVIDENCE.threshold_count) {
    score *= MULTIPLIERS.STRONG_EVIDENCE.value;
    reasons.push(
      `[STRONG EVIDENCE] ${evidenceCount} supporting items submitted. ×${MULTIPLIERS.STRONG_EVIDENCE.value} applied.`
    );
  } else if (evidenceCount >= MULTIPLIERS.SOME_EVIDENCE.threshold_count) {
    score *= MULTIPLIERS.SOME_EVIDENCE.value;
    reasons.push(
      `[SOME EVIDENCE] ${evidenceCount} supporting item(s) submitted. ×${MULTIPLIERS.SOME_EVIDENCE.value} applied.`
    );
  }

  // 7. Mature policy (held >180 days)
  if (!isNaN(daysSinceStart) && daysSinceStart > MULTIPLIERS.MATURE_POLICY.threshold_days) {
    score *= MULTIPLIERS.MATURE_POLICY.value;
    reasons.push(
      `[MATURE POLICY] Policy is ${daysSinceStart} days old (>${MULTIPLIERS.MATURE_POLICY.threshold_days} days). ×${MULTIPLIERS.MATURE_POLICY.value} applied.`
    );
  }

  // 8. Low value claim (<30% of coverage limit)
  if (coverageLimit > 0 && claimAmount > 0) {
    const ratio = claimAmount / coverageLimit;
    if (ratio < MULTIPLIERS.LOW_VALUE_CLAIM.threshold_pct_of_limit) {
      score *= MULTIPLIERS.LOW_VALUE_CLAIM.value;
      reasons.push(
        `[LOW VALUE] Rs.${claimAmount.toLocaleString()} is only ${(ratio * 100).toFixed(1)}% of policy limit — not maximising payout. ×${MULTIPLIERS.LOW_VALUE_CLAIM.value} applied.`
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Compilation & Tiering
  // ─────────────────────────────────────────────────────────────────────────────

  const rawScore = Math.round(score);
  const fraud_score = Math.min(Math.max(rawScore, 0), 100);

  let risk_flag = 'HIGH';
  if (fraud_score <= TIERS.LOW_MAX) {
    risk_flag = 'LOW';
  } else if (fraud_score <= TIERS.MEDIUM_MAX) {
    risk_flag = 'MEDIUM';
  }

  if (reasons.length === 0) {
    reasons.push('[CLEAN] No suspicious patterns detected.');
  }

  if (rawScore > 100) {
    reasons.push(`[NOTE] Raw compounded score was ${rawScore} — clamped to 100.`);
  }

  return {
    fraud_score,
    risk_flag,
    reasons
  };
}

module.exports = { detectFraud };
