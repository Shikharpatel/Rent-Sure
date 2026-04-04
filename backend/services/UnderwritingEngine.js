/**
 * UnderwritingEngine.js
 *
 * Purpose  : Calculate tenant risk for the Rental Insurance Platform.
 * Version  : 2.0 — configurable registry, weight transparency, clean output
 *
 * Design constraints:
 *  - Each factor is an isolated evaluator. This makes each rule independently
 *    testable and removable without touching other logic.
 *  - City risk is driven by an external CITY_RISK_REGISTRY object.
 *    To update city risk tiers, edit only that registry — do not touch engine logic.
 *  - All null/undefined inputs are handled explicitly with defined penalties.
 *  - Score is always clamped [0, 100] with an audit note if clamping fires.
 *
 * Canonical output shape (stable contract for downstream engines):
 * {
 *   risk_score             : number    — 0 (riskiest) to 100 (safest)
 *   risk_level             : string    — 'low' | 'medium' | 'high'
 *   probability_of_default : number    — 0.0000 to 0.5000
 *   reasoning              : string[]  — one entry per evaluated factor
 *   metadata               : object    — factor_breakdown, income_rent_ratio (for PricingEngine)
 * }
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURABLE CITY RISK REGISTRY
//
// Format: { 'city_name_lowercase': tier_number }
// Tier 1 = High-risk metro  (elevated renter default rates, expensive markets)
// Tier 2 = Medium-risk city (secondary markets with moderate observed defaults)
// Tier 3 = Low-risk market  (default — applied to any city not listed below)
//
// HOW TO UPDATE: Add or change entries here only. Engine logic is untouched.
// Future: load this from a DB config table to allow Admin panel control.
// ─────────────────────────────────────────────────────────────────────────────
const CITY_RISK_REGISTRY = {
  // Tier 1 — High-risk metros
  mumbai: 1, delhi: 1, bangalore: 1, hyderabad: 1, pune: 1, noida: 1, gurgaon: 1,

  // Tier 2 — Medium-risk secondary cities
  ahmedabad: 2, surat: 2, jaipur: 2, lucknow: 2, chandigarh: 2,
  kochi: 2, bhopal: 2, nagpur: 2, visakhapatnam: 2, coimbatore: 2,

  // All other cities resolve to Tier 3 (low risk) — see getCityTier() default
};

/**
 * Returns the risk tier (1=high, 2=medium, 3=low) for a given city string.
 * Exported so tests and PricingEngine can inspect city tiers directly.
 */
function getCityTier(city) {
  if (!city || typeof city !== 'string') return 3;
  const key = city.toLowerCase().trim();
  return CITY_RISK_REGISTRY[key] || 3; // Default: Tier 3 (low risk)
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual Factor Evaluators
// Each returns: { delta: number, reason: string }
// delta = points added (positive) or deducted (negative) from base score
// ─────────────────────────────────────────────────────────────────────────────

// WEIGHT: HIGH IMPACT — single largest contributor to risk score
function evaluateIncomeRentRatio(monthlyIncome, rentAmount) {
  // Missing data: apply conservative penalty and flag it explicitly
  const incomeVal = parseFloat(monthlyIncome);
  const rentVal   = parseFloat(rentAmount);

  if (!monthlyIncome || isNaN(incomeVal) || !rentAmount || isNaN(rentVal) || rentVal <= 0) {
    return {
      delta: -25,
      weight: 'HIGH IMPACT',
      reason: '[HIGH IMPACT] -25 pts: Income data not provided — conservative penalty applied (missing critical input)'
    };
  }

  const ratio    = incomeVal / rentVal;
  const ratioStr = ratio.toFixed(2);

  if (ratio >= 4) {
    return { delta: +5,  weight: 'HIGH IMPACT', reason: `[HIGH IMPACT] +5 pts: Income-to-Rent ratio ${ratioStr}x is excellent — strong affordability (>=4x)` };
  } else if (ratio >= 3) {
    return { delta: -5,  weight: 'HIGH IMPACT', reason: `[HIGH IMPACT] -5 pts: Income-to-Rent ratio ${ratioStr}x is strong (>=3x)` };
  } else if (ratio >= 2) {
    return { delta: -15, weight: 'HIGH IMPACT', reason: `[HIGH IMPACT] -15 pts: Income-to-Rent ratio ${ratioStr}x is acceptable but not strong (>=2x)` };
  } else if (ratio >= 1.5) {
    return { delta: -25, weight: 'HIGH IMPACT', reason: `[HIGH IMPACT] -25 pts: Income-to-Rent ratio ${ratioStr}x is borderline — rent is a high proportion of income` };
  } else {
    return { delta: -40, weight: 'HIGH IMPACT', reason: `[HIGH IMPACT] -40 pts: Income-to-Rent ratio ${ratioStr}x is critically low — high probability of payment stress` };
  }
}

// WEIGHT: HIGH IMPACT — income continuity is a primary default predictor
function evaluateEmploymentStability(months) {
  // Missing data: months not provided — apply moderate conservative penalty
  if (months === null || months === undefined || isNaN(parseInt(months))) {
    return {
      delta: -10,
      weight: 'HIGH IMPACT',
      reason: '[HIGH IMPACT] -10 pts: Employment duration not provided — conservative penalty applied'
    };
  }

  const m = parseInt(months);

  if (m >= 24) {
    return { delta: +5,  weight: 'HIGH IMPACT', reason: `[HIGH IMPACT] +5 pts: ${m} months employment — strong income continuity (>=24 months)` };
  } else if (m >= 12) {
    return { delta: -5,  weight: 'HIGH IMPACT', reason: `[HIGH IMPACT] -5 pts: ${m} months employment — adequate stability (>=12 months)` };
  } else if (m >= 6) {
    return { delta: -10, weight: 'HIGH IMPACT', reason: `[HIGH IMPACT] -10 pts: ${m} months employment — short tenure, some income instability risk` };
  } else {
    return { delta: -20, weight: 'HIGH IMPACT', reason: `[HIGH IMPACT] -20 pts: ${m} months employment — very short, significant income instability risk` };
  }
}

// WEIGHT: HIGH IMPACT — KYC is a hard gate; rejection is a pipeline blocker
function evaluateKYCStatus(kycStatus) {
  switch (kycStatus) {
    case 'approved':
      return { delta: 0,   weight: 'HIGH IMPACT', reason: '[HIGH IMPACT] 0 pts: KYC approved — identity and documents fully verified' };
    case 'pending':
      return { delta: -15, weight: 'HIGH IMPACT', reason: '[HIGH IMPACT] -15 pts: KYC pending — identity unverified, elevated uncertainty' };
    case 'rejected':
      return { delta: -40, weight: 'HIGH IMPACT', reason: '[HIGH IMPACT] -40 pts: KYC rejected — identity verification failed, very high risk signal' };
    default:
      // Handles null, undefined, or any unexpected string
      return { delta: -20, weight: 'HIGH IMPACT', reason: '[HIGH IMPACT] -20 pts: KYC status unknown — applying conservative penalty for missing identity data' };
  }
}

// WEIGHT: MODERATE IMPACT — location shifts risk but does not dominate alone
function evaluateCityRisk(city) {
  // Missing city: no penalty applied, but flagged in reasoning for transparency
  if (!city || typeof city !== 'string' || city.trim() === '') {
    return { delta: 0, weight: 'MODERATE IMPACT', reason: '[MODERATE IMPACT] 0 pts: City not provided — no location penalty applied, defaulting to Tier 3' };
  }

  const tier      = getCityTier(city);
  const cityLabel = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();

  if (tier === 1) {
    return { delta: -10, weight: 'MODERATE IMPACT', reason: `[MODERATE IMPACT] -10 pts: ${cityLabel} is a Tier 1 high-density metro — elevated historical default rates` };
  } else if (tier === 2) {
    return { delta: -5,  weight: 'MODERATE IMPACT', reason: `[MODERATE IMPACT] -5 pts: ${cityLabel} is a Tier 2 secondary city — moderate market risk` };
  } else {
    return { delta: 0,   weight: 'MODERATE IMPACT', reason: `[MODERATE IMPACT] 0 pts: ${cityLabel} is a Tier 3 lower-risk market` };
  }
}

// WEIGHT: LOW IMPACT — secondary asset risk factor, influences claim severity not default
function evaluateFurnishingLevel(furnishingLevel) {
  switch (furnishingLevel) {
    case 'fully_furnished':
      return { delta: -10, weight: 'LOW IMPACT', reason: '[LOW IMPACT] -10 pts: Fully furnished — higher asset exposure, increases potential claim severity' };
    case 'semi_furnished':
      return { delta: -5,  weight: 'LOW IMPACT', reason: '[LOW IMPACT] -5 pts: Semi-furnished — moderate asset exposure' };
    case 'unfurnished':
    default:
      // Handles null/undefined gracefully — defaults to unfurnished (safe assumption)
      return { delta: 0,   weight: 'LOW IMPACT', reason: '[LOW IMPACT] 0 pts: Unfurnished (or not specified) — minimal asset exposure, standard risk' };
  }
}

// WEIGHT: HIGH IMPACT — behavioral history is the strongest default predictor in insurance
function evaluatePriorDefaults(priorDefaults) {
  // Null/undefined treated as 0 defaults (benefit of the doubt if not declared)
  const d = (priorDefaults === null || priorDefaults === undefined) ? 0 : parseInt(priorDefaults);
  const safeD = isNaN(d) ? 0 : d;

  if (safeD === 0) {
    return { delta: +5,  weight: 'HIGH IMPACT', reason: '[HIGH IMPACT] +5 pts: No prior rental defaults — strong behavioral reliability signal' };
  } else if (safeD === 1) {
    return { delta: -20, weight: 'HIGH IMPACT', reason: `[HIGH IMPACT] -20 pts: 1 prior rental default — indicates prior payment difficulty` };
  } else {
    return { delta: -35, weight: 'HIGH IMPACT', reason: `[HIGH IMPACT] -35 pts: ${safeD} prior rental defaults — pattern of payment failure, high risk` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk Level Classification
// ─────────────────────────────────────────────────────────────────────────────
function classifyRisk(score) {
  if (score >= 75) return 'low';
  if (score >= 50) return 'medium';
  return 'high';
}

// ─────────────────────────────────────────────────────────────────────────────
// Probability of Default Calculation
// Formula: (100 - score) / 200
// Range: score=100 → PoD=0.00 | score=0 → PoD=0.50
// Rationale: Maximum realistic default probability for a rental product is ~50%
// ─────────────────────────────────────────────────────────────────────────────
function calculateProbabilityOfDefault(score) {
  return parseFloat(((100 - score) / 200).toFixed(4));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Engine Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assesses the underwriting risk for a tenant applying for a rental protection policy.
 *
 * @param {object} inputs
 * @param {number}  inputs.monthlyIncome           - Tenant's gross monthly income (INR)
 * @param {number}  inputs.rentAmount              - Monthly rent of the target property (INR)
 * @param {number}  inputs.employmentStabilityMonths - Months at current job/income source
 * @param {string}  inputs.kycStatus               - 'approved' | 'pending' | 'rejected'
 * @param {string}  inputs.city                    - City where the property is located
 * @param {string}  inputs.furnishingLevel         - 'unfurnished' | 'semi_furnished' | 'fully_furnished'
 * @param {number}  inputs.priorDefaults           - Number of prior rental defaults (0 if clean)
 *
 * @returns {object} Underwriting result with risk_score, risk_level, probability_of_default, reasoning
 */
function assess(inputs = {}) {
  const {
    monthlyIncome,
    rentAmount,
    employmentStabilityMonths,
    kycStatus,
    city,
    furnishingLevel,
    priorDefaults = 0,
  } = inputs;

  const BASE_SCORE = 100;
  const reasoning = [];

  // Run all factor evaluators
  const factors = [
    { key: 'income_rent_ratio',       result: evaluateIncomeRentRatio(monthlyIncome, rentAmount) },
    { key: 'employment_stability',    result: evaluateEmploymentStability(employmentStabilityMonths) },
    { key: 'kyc_status',              result: evaluateKYCStatus(kycStatus) },
    { key: 'prior_defaults',          result: evaluatePriorDefaults(priorDefaults) },
  ];

  // ── Accumulate deltas and build reasoning ──────────────────────────────────
  let totalDelta = 0;
  const factor_breakdown = {};

  for (const { key, result } of factors) {
    factor_breakdown[key] = { delta: result.delta, weight: result.weight };
    reasoning.push(result.reason);
    totalDelta += result.delta;
  }

  // ── Score Clamping (explicit, with audit note if boundary was hit) ──────────
  const raw_score  = BASE_SCORE + totalDelta;
  let   risk_score = raw_score;

  if (raw_score > 100) {
    reasoning.push(`[CLAMP] Score was ${raw_score} — clamped to 100 (maximum safe boundary)`);
    risk_score = 100;
  } else if (raw_score < 0) {
    reasoning.push(`[CLAMP] Score was ${raw_score} — clamped to 0 (minimum boundary)`);
    risk_score = 0;
  }

  const risk_level             = classifyRisk(risk_score);
  const probability_of_default = calculateProbabilityOfDefault(risk_score);

  // ── Summary reasoning entry ─────────────────────────────────────────────────
  reasoning.push(
    `[SUMMARY] Risk Score: ${risk_score}/100 | Level: ${risk_level.toUpperCase()} | P(Default): ${(probability_of_default * 100).toFixed(1)}%`
  );

  // ── Canonical output (stable contract for PricingEngine and DB persistence) ─
  return {
    risk_score,
    risk_level,
    probability_of_default,
    reasoning,
    metadata: {
      factor_breakdown,
      income_rent_ratio: (monthlyIncome && rentAmount)
        ? parseFloat((parseFloat(monthlyIncome) / parseFloat(rentAmount)).toFixed(2))
        : null,
      raw_score_before_clamp: raw_score,
    },
  };
}

module.exports = { assess, getCityTier };
