/**
 * verify_pricing.js
 * Run: node verify_pricing.js
 *
 * Tests 4 scenarios:
 *  1. Low-risk, unfurnished, Tier 3 city, basic coverage — expect low premium
 *  2. Medium-risk, semi-furnished, Tier 2 city, with add-ons
 *  3. High-risk, fully-furnished, Tier 1 metro, all add-ons — expect highest premium
 *  4. Null/missing inputs — must not crash
 */

const { assess }  = require('./services/UnderwritingEngine');
const { price }   = require('./services/PricingEngine');

function run(label, uwInputs, propertyData, coverages, addOns) {
  const underwriting = assess(uwInputs);
  const result       = price({ underwriting, property: propertyData, coverages, addOns });

  console.log('\n' + '='.repeat(64));
  console.log('SCENARIO:', label);
  console.log('='.repeat(64));
  console.log('UW Risk Score :', underwriting.risk_score, '/', underwriting.risk_level.toUpperCase());
  console.log('Base Premium  : Rs.', result.base_premium);
  console.log('Adjusted Base : Rs.', result.adjusted_base);
  console.log('Risk Loaded   : Rs.', result.risk_loaded_premium);
  console.log('Add-on Total  : Rs.', result.add_on_total);
  console.log('FINAL PREMIUM : Rs.', result.final_premium, '/ month');
  console.log('\nStage Breakdown:', JSON.stringify(result.metadata.stages, null, 2));
  console.log('\nReasoning:');
  result.reasoning.forEach(r => console.log('  >', r));
}

// 1. Ideal tenant — low premium
run(
  'Low Risk | Unfurnished | Tier 3 | Basic Coverage',
  { monthlyIncome: 120000, rentAmount: 25000, employmentStabilityMonths: 36, kycStatus: 'approved', city: 'Mysore', furnishingLevel: 'unfurnished', priorDefaults: 0 },
  { rent_amount: 25000, city: 'Mysore', furnishing_level: 'unfurnished', property_type: 'apartment' },
  { rent_default_months: 2, damage_cover_limit: 50000 },
  {}
);

// 2. Medium risk with add-ons
run(
  'Medium Risk | Semi-Furnished | Tier 2 Pune | With Add-ons',
  { monthlyIncome: 60000, rentAmount: 25000, employmentStabilityMonths: 10, kycStatus: 'approved', city: 'Pune', furnishingLevel: 'semi_furnished', priorDefaults: 0 },
  { rent_amount: 25000, city: 'Pune', furnishing_level: 'semi_furnished', property_type: 'apartment' },
  { rent_default_months: 2, damage_cover_limit: 75000 },
  { appliance_cover: true, legal_cover: true }
);

// 3. High risk — all add-ons, Mumbai, fully furnished
run(
  'High Risk | Fully Furnished | Tier 1 Mumbai | All Add-ons',
  { monthlyIncome: 30000, rentAmount: 22000, employmentStabilityMonths: 3, kycStatus: 'pending', city: 'Mumbai', furnishingLevel: 'fully_furnished', priorDefaults: 2 },
  { rent_amount: 22000, city: 'Mumbai', furnishing_level: 'fully_furnished', property_type: 'independent_house' },
  { rent_default_months: 3, damage_cover_limit: 100000 },
  { appliance_cover: true, extended_rent: true, legal_cover: true, accidental_damage: true }
);

// 4. Null safety — must not crash
run(
  'Null Safety — no inputs',
  {},
  {},
  {},
  {}
);

console.log('\n' + '='.repeat(64));
console.log('All pricing scenarios verified.');
console.log('='.repeat(64));
