/**
 * PricingEngine.js
 *
 * Purpose  : Calculate the insurance premium for a rental protection policy.
 * Version  : 1.1 — deductible discount, tiered damage cover, safety cap, explainability summary
 *
 * Design constraints:
 *  - Standalone service. No DB calls, no controller coupling.
 *  - Accepts output from UnderwritingEngine directly as `underwriting` input.
 *  - Uses getCityTier from UnderwritingEngine — does NOT re-implement city logic.
 *  - All pricing rules are named constants at the top. Change rates here only.
 *  - Every stage emits an audit entry to `adjustments[]` and `reasoning[]`.
 *
 * Pricing Model (5 Stages):
 *  1. Base Premium       = rent_amount × BASE_RATE
 *  2. Coverage Costs     = rent_default_cost + damage_cover_cost
 *  3. Property Surcharge = furnishing % + city_tier % + property_type %  (on accumulated total)
 *  4. Risk Multiplier    = risk_level multiplier applied to full accumulated amount
 *  5. Add-on Flat Costs  = fixed monthly INR per selected add-on
 *
 * Canonical output shape (stable contract for controllers and DB persistence):
 * {
 *   final_premium          : number   — total monthly premium in INR (rounded)
 *   base_premium           : number   — Stage 1 result before any adjustments
 *   adjusted_base          : number   — After Stages 1-3, before risk multiplier
 *   risk_loaded_premium    : number   — After Stage 4 risk multiplier
 *   add_on_total           : number   — Sum of all Stage 5 add-on costs
 *   adjustments            : object[] — Itemized audit trail of every applied change
 *   reasoning              : string[] — Human-readable explanation of each decision
 *   explainability_summary : string   — One-sentence plain-English premium explanation
 * }
 */

const { getCityTier } = require('./UnderwritingEngine');

// ─────────────────────────────────────────────────────────────────────────────
// PRICING RATE CONSTANTS
// All rate changes must only happen here. Engine logic is left untouched.
// ─────────────────────────────────────────────────────────────────────────────

const RATES = {
  // Stage 1: Base rate applied to monthly rent
  BASE_RATE: 0.015, // 1.5% of monthly rent

  // Stage 2: Rent default coverage rate
  RENT_DEFAULT_RATE_PER_MONTH: 0.008, // 0.8% of rent per month of coverage

  // Stage 2: Damage cover — tiered diminishing rates (more realistic than flat linear)
  // Rationale: marginal cost of insuring incremental coverage decreases at higher limits
  // (insurers diversify portfolio risk at scale — passes through as lower per-unit cost)
  DAMAGE_COVER_TIERS: [
    { upTo: 50000,   rate: 0.008 }, // 0.8% on first Rs.50k
    { upTo: 150000,  rate: 0.006 }, // 0.6% on Rs.50k–Rs.150k
    { upTo: Infinity, rate: 0.004 }, // 0.4% on anything above Rs.150k
  ],

  // Deductible discount factor: applies as small (-) to final pre-cap premium.
  // Deductible = tenant bears first X of any claim → reduces insurer exposure slightly.
  // Max discount: 10% (deductible >= Rs.25,000). Non-dominant — capped at 10%.
  DEDUCTIBLE_DISCOUNT_TIERS: [
    { atLeast: 25000, discount: 0.10 },
    { atLeast: 10000, discount: 0.06 },
    { atLeast: 5000,  discount: 0.03 },
    { atLeast: 0,     discount: 0.00 },
  ],

  // Premium Safety Cap: maximum monthly premium as multiple of monthly rent.
  // Prevents unrealistic premiums from extreme input combinations.
  // E.g., cap = 25% means: premium > 0.25 * rent triggers cap (and reasoning note).
  PREMIUM_CAP_RENT_MULTIPLE: 0.25,

  // Stage 3: Property surcharges (as multiplier on accumulated premium)
  FURNISHING: {
    unfurnished:     0.00,
    semi_furnished:  0.08,  // +8%
    fully_furnished: 0.15,  // +15%
  },
  CITY_TIER: {
    1: 0.12, // Tier 1 metro — +12%
    2: 0.06, // Tier 2 city  — +6%
    3: 0.00, // Tier 3 low   — no surcharge
  },
  PROPERTY_TYPE: {
    apartment:        0.00,
    independent_house: 0.05, // +5% — larger footprint, more exposure
    other:            0.03,
  },

  // Stage 4: Risk multipliers
  RISK_MULTIPLIER: {
    low:    1.00, // No additional loading
    medium: 1.30, // +30%
    high:   1.60, // +60%
  },

  // Stage 5: Add-on flat monthly costs (INR)
  ADD_ONS: {
    appliance_cover:   250,
    extended_rent:     350, // One extra month of rent-default cover
    legal_cover:       200,
    accidental_damage: 150,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage Evaluators
// Each returns: { amount: number, adjustment: object, reason: string }
// ─────────────────────────────────────────────────────────────────────────────

function calcBasePremium(rentAmount) {
  const rent = parseFloat(rentAmount) || 0;
  if (rent <= 0) {
    return {
      amount: 0,
      adjustment: { label: 'Base Premium', amount: 0, type: 'base', note: 'rent_amount missing or zero' },
      reason: '[BASE] Rent amount not provided — base premium could not be calculated',
    };
  }
  const amount = rent * RATES.BASE_RATE;
  return {
    amount,
    adjustment: { label: 'Base Premium (1.5% of rent)', amount: Math.round(amount), type: 'base' },
    reason: `[BASE] Base premium = 1.5% of monthly rent Rs.${rent.toLocaleString()} = Rs.${Math.round(amount)}`,
  };
}

function calcCoverageCosts(rentAmount, rentDefaultMonths, damageCoverLimit) {
  const rent    = parseFloat(rentAmount) || 0;
  const months  = parseInt(rentDefaultMonths) || 0;
  const damage  = parseFloat(damageCoverLimit) || 0;
  const results = [];

  let total = 0;

  // Rent default cover — linear (straightforward)
  if (months > 0) {
    const cost = rent * months * RATES.RENT_DEFAULT_RATE_PER_MONTH;
    total += cost;
    results.push({
      adjustment: { label: `Rent Default Cover (${months} month${months > 1 ? 's' : ''})`, amount: Math.round(cost), type: 'coverage' },
      reason: `[COVERAGE] Rent Default (${months}mo) = rent Rs.${rent} x ${months} x 0.8% = Rs.${Math.round(cost)}`,
    });
  }

  // Damage cover — tiered diminishing rates (more realistic than flat linear)
  if (damage > 0) {
    let remaining = damage;
    let tierCost  = 0;
    let prevLimit = 0;
    const tierBreakdown = [];

    for (const tier of RATES.DAMAGE_COVER_TIERS) {
      if (remaining <= 0) break;
      const tierBand  = Math.min(remaining, tier.upTo - prevLimit);
      const bandCost  = tierBand * tier.rate;
      tierCost       += bandCost;
      const tierUpTo  = tier.upTo === Infinity ? 'above' : `Rs.${tier.upTo.toLocaleString()}`;
      tierBreakdown.push(`Rs.${Math.round(tierBand).toLocaleString()} @ ${(tier.rate * 100).toFixed(1)}%`);
      remaining -= tierBand;
      prevLimit  = tier.upTo;
    }

    total += tierCost;
    results.push({
      adjustment: { label: `Property Damage Cover (limit Rs.${damage.toLocaleString()})`, amount: Math.round(tierCost), type: 'coverage' },
      reason: `[COVERAGE] Damage Cover (tiered): ${tierBreakdown.join(' + ')} = Rs.${Math.round(tierCost)}`,
    });
  }

  if (results.length === 0) {
    results.push({
      adjustment: { label: 'No Core Coverages Selected', amount: 0, type: 'coverage' },
      reason: '[COVERAGE] No rent-default or damage cover selected — no coverage cost added',
    });
  }

  return { total, results };
}

function calcPropertySurcharges(accumulatedPremium, furnishingLevel, city, propertyType) {
  const results = [];
  let surchargeTotal = 0;

  // Furnishing surcharge
  const furnishingRate = RATES.FURNISHING[furnishingLevel] ?? RATES.FURNISHING.unfurnished;
  const furnishingCost = accumulatedPremium * furnishingRate;
  surchargeTotal += furnishingCost;
  const furnishLabel = furnishingLevel || 'unfurnished';
  results.push({
    adjustment: { label: `Furnishing Surcharge (${furnishLabel}) +${(furnishingRate * 100).toFixed(0)}%`, amount: Math.round(furnishingCost), type: 'property' },
    reason: furnishingRate > 0
      ? `[PROPERTY] ${furnishLabel} property → +${(furnishingRate * 100).toFixed(0)}% surcharge = Rs.${Math.round(furnishingCost)}`
      : `[PROPERTY] Unfurnished property → no furnishing surcharge`,
  });

  // City tier surcharge
  const tier = getCityTier(city);
  const cityRate = RATES.CITY_TIER[tier] ?? 0;
  const cityCost = accumulatedPremium * cityRate;
  surchargeTotal += cityCost;
  const cityLabel = city ? (city.charAt(0).toUpperCase() + city.slice(1).toLowerCase()) : 'Unknown';
  results.push({
    adjustment: { label: `City Tier ${tier} Surcharge (${cityLabel}) +${(cityRate * 100).toFixed(0)}%`, amount: Math.round(cityCost), type: 'property' },
    reason: cityRate > 0
      ? `[PROPERTY] ${cityLabel} (Tier ${tier}) → +${(cityRate * 100).toFixed(0)}% surcharge = Rs.${Math.round(cityCost)}`
      : `[PROPERTY] ${cityLabel} (Tier ${tier}) → no city surcharge`,
  });

  // Property type surcharge
  const typeRate = RATES.PROPERTY_TYPE[propertyType] ?? RATES.PROPERTY_TYPE.other;
  const typeCost = accumulatedPremium * typeRate;
  surchargeTotal += typeCost;
  const typeLabel = propertyType || 'unspecified';
  results.push({
    adjustment: { label: `Property Type Surcharge (${typeLabel}) +${(typeRate * 100).toFixed(0)}%`, amount: Math.round(typeCost), type: 'property' },
    reason: typeRate > 0
      ? `[PROPERTY] ${typeLabel} → +${(typeRate * 100).toFixed(0)}% surcharge = Rs.${Math.round(typeCost)}`
      : `[PROPERTY] ${typeLabel} → no property type surcharge`,
  });

  return { total: surchargeTotal, results };
}

function applyRiskMultiplier(accumulatedPremium, riskLevel) {
  const level      = ['low', 'medium', 'high'].includes(riskLevel) ? riskLevel : 'medium';
  const multiplier = RATES.RISK_MULTIPLIER[level];
  const loaded     = accumulatedPremium * multiplier;
  const increase   = loaded - accumulatedPremium;

  const labels = { low: 'No loading — low risk', medium: '+30% risk loading', high: '+60% risk loading' };
  return {
    risk_loaded_premium: loaded,
    risk_increase: increase,
    multiplier,
    adjustment: { label: `Risk Multiplier (${level.toUpperCase()}) ${multiplier}x`, amount: Math.round(increase), type: 'risk' },
    reason: `[RISK] ${level.toUpperCase()} risk → ${multiplier}x multiplier → Rs.${Math.round(increase)} added (${labels[level]})`,
  };
}

function calcAddOns(addOns = {}) {
  const results = [];
  let total = 0;

  for (const [key, enabled] of Object.entries(addOns)) {
    if (!enabled) continue;
    const cost = RATES.ADD_ONS[key];
    if (cost === undefined) {
      results.push({
        adjustment: { label: `Unknown Add-on: ${key}`, amount: 0, type: 'addon', note: 'unrecognised add-on key ignored' },
        reason: `[ADDON] Unrecognised add-on '${key}' — skipped`,
      });
      continue;
    }
    total += cost;
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    results.push({
      adjustment: { label: `Add-on: ${label}`, amount: cost, type: 'addon' },
      reason: `[ADDON] ${label} → +Rs.${cost}/month`,
    });
  }

  if (results.length === 0) {
    results.push({
      adjustment: { label: 'No Add-ons Selected', amount: 0, type: 'addon' },
      reason: '[ADDON] No optional add-ons selected',
    });
  }

  return { total, results };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Engine Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates the insurance premium for a rental protection policy.
 *
 * @param {object} inputs
 * @param {object} inputs.underwriting         - Full output from UnderwritingEngine.assess()
 * @param {object} inputs.property             - Property attributes
 * @param {number} inputs.property.rent_amount - Monthly rent in INR
 * @param {string} inputs.property.city
 * @param {string} inputs.property.furnishing_level
 * @param {string} inputs.property.property_type
 * @param {object} inputs.coverages            - Coverage selections
 * @param {number} inputs.coverages.rent_default_months - 0-3
 * @param {number} inputs.coverages.damage_cover_limit  - INR limit, 0 to skip
 * @param {object} inputs.addOns               - Add-on boolean flags
 *
 * @returns {object} Pricing result — canonical output shape
 */
function price(inputs = {}) {
  const {
    underwriting = {},
    property = {},
    coverages = {},
    addOns = {},
  } = inputs;

  const { risk_level = 'medium', risk_score = 50, probability_of_default = 0.25 } = underwriting;
  const { rent_amount, city, furnishing_level, property_type } = property;
  const { rent_default_months = 0, damage_cover_limit = 0, deductible = 0 } = coverages;

  const adjustments = [];
  const reasoning   = [];

  // ── Stage 1: Base Premium ──────────────────────────────────────────────────
  const stage1 = calcBasePremium(rent_amount);
  adjustments.push(stage1.adjustment);
  reasoning.push(stage1.reason);
  let accumulated = stage1.amount;

  // ── Stage 2: Coverage Costs ────────────────────────────────────────────────
  const stage2 = calcCoverageCosts(rent_amount, rent_default_months, damage_cover_limit);
  for (const r of stage2.results) {
    adjustments.push(r.adjustment);
    reasoning.push(r.reason);
  }
  accumulated += stage2.total;

  // ── Stage 3: Property Surcharges ───────────────────────────────────────────
  const stage3 = calcPropertySurcharges(accumulated, furnishing_level, city, property_type);
  for (const r of stage3.results) {
    adjustments.push(r.adjustment);
    reasoning.push(r.reason);
  }
  accumulated += stage3.total;
  const adjusted_base = accumulated;

  // ── Stage 4: Risk Multiplier ───────────────────────────────────────────────
  const stage4 = applyRiskMultiplier(accumulated, risk_level);
  adjustments.push(stage4.adjustment);
  reasoning.push(stage4.reason);
  const risk_loaded_premium = stage4.risk_loaded_premium;

  // ── Stage 5: Add-on Flat Costs ─────────────────────────────────────────────
  const stage5 = calcAddOns(addOns);
  for (const r of stage5.results) {
    adjustments.push(r.adjustment);
    reasoning.push(r.reason);
  }
  const add_on_total = stage5.total;

  // ── Final Premium (before deductible and cap) ──────────────────────────────
  let final_premium = Math.round(risk_loaded_premium + add_on_total);

  // ── Deductible Discount (applied after risk loading, before cap) ──────────
  // Tenant bears first Rs.deductible of any claim — reduces insurer exposure slightly.
  const deductibleVal = parseFloat(deductible) || 0;
  let deductible_discount = 0;
  let deductible_discount_pct = 0;
  if (deductibleVal > 0) {
    const tier = RATES.DEDUCTIBLE_DISCOUNT_TIERS.find(t => deductibleVal >= t.atLeast);
    deductible_discount_pct = tier ? tier.discount : 0;
    if (deductible_discount_pct > 0) {
      deductible_discount = Math.round(final_premium * deductible_discount_pct);
      final_premium -= deductible_discount;
      adjustments.push({ label: `Deductible Discount (Rs.${deductibleVal.toLocaleString()}) -${(deductible_discount_pct*100).toFixed(0)}%`, amount: -deductible_discount, type: 'deductible' });
      reasoning.push(`[DEDUCTIBLE] Tenant deductible Rs.${deductibleVal.toLocaleString()} → -${(deductible_discount_pct*100).toFixed(0)}% discount = -Rs.${deductible_discount}`);
    }
  }

  // ── Safety Cap (applied last — absolute ceiling) ─────────────────────────
  // Cap = 25% of monthly rent. Prevents extreme combinations from producing absurd premiums.
  const rentVal   = parseFloat(rent_amount) || 0;
  const cap_limit = rentVal > 0 ? Math.round(rentVal * RATES.PREMIUM_CAP_RENT_MULTIPLE) : null;
  let cap_applied = false;
  if (cap_limit && final_premium > cap_limit) {
    adjustments.push({ label: `Safety Cap Applied (25% of rent)`, amount: -(final_premium - cap_limit), type: 'cap' });
    reasoning.push(`[CAP] Premium Rs.${final_premium} exceeded cap of Rs.${cap_limit} (25% of rent Rs.${rentVal.toLocaleString()}) — capped at Rs.${cap_limit}`);
    final_premium = cap_limit;
    cap_applied   = true;
  }

  // ── Explainability Summary (one human-readable sentence) ──────────────────
  const drivers = [];
  if (['medium', 'high'].includes(risk_level)) drivers.push(`${risk_level} tenant risk`);
  if (furnishing_level === 'fully_furnished') drivers.push('fully furnished property');
  else if (furnishing_level === 'semi_furnished') drivers.push('semi-furnished property');
  const tier = getCityTier(city);
  if (tier === 1) drivers.push(`metro city (${city || 'Tier 1'})`);
  else if (tier === 2) drivers.push(`secondary city (${city || 'Tier 2'})`);
  if (deductible_discount_pct > 0) drivers.push(`deductible discount applied`);
  if (cap_applied) drivers.push(`safety cap activated`);
  const explainability_summary = drivers.length > 0
    ? `Premium of Rs.${final_premium}/month driven by: ${drivers.join(', ')}.`
    : `Premium of Rs.${final_premium}/month reflects standard base rate with no significant risk factors.`;

  reasoning.push(`[EXPLAIN] ${explainability_summary}`);

  // ── Math Summary ─────────────────────────────────────────────────────────────
  reasoning.push(
    `[SUMMARY] Base Rs.${Math.round(stage1.amount)} + Coverages Rs.${Math.round(stage2.total)} + Property Surcharges Rs.${Math.round(stage3.total)} → Adjusted Base Rs.${Math.round(adjusted_base)} x ${stage4.multiplier}x Risk + Rs.${add_on_total} Add-ons - Rs.${deductible_discount} Deductible Discount = Final Premium Rs.${final_premium}/month`
  );

  return {
    final_premium,
    base_premium:           Math.round(stage1.amount),
    adjusted_base:          Math.round(adjusted_base),
    risk_loaded_premium:    Math.round(risk_loaded_premium),
    add_on_total,
    adjustments,
    reasoning,
    explainability_summary,
    // Metadata for transparency and audit
    metadata: {
      risk_score,
      risk_level,
      probability_of_default,
      multiplier_applied: stage4.multiplier,
      deductible_discount,
      cap_applied,
      stages: {
        base:               Math.round(stage1.amount),
        coverage_costs:     Math.round(stage2.total),
        property_surcharge: Math.round(stage3.total),
        risk_loading:       Math.round(stage4.risk_increase),
        add_ons:            add_on_total,
        deductible_discount: -deductible_discount,
      },
    },
  };
}

module.exports = { price, RATES };
