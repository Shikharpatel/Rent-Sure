/**
 * verify_adjudicator.js
 */

const { adjudicate } = require('./services/ClaimsAdjudicator');

function run(label, inputs) {
  const result = adjudicate(inputs);
  console.log('\n---', label, '---');
  console.log('Approved?        ', result.approved);
  console.log('Final Payout     ', result.calculated_payout);
  console.log('\nBreakdown        ', JSON.stringify(result.breakdown, null, 2));
  console.log('\nReasoning:');
  result.reasoning.forEach(r => console.log('  >', r));
}

// 1. Invalid Claim (rejected at validation gate)
run('Invalid Claim Gate', {
  claim: { claim_amount: 50000 },
  policy: { coverage_limit: 100000, deductible: 5000 },
  validation_result: { is_valid: false, rejection_reasons: ['Not a covered event.'] }
});

// 2. Simple Math (No depreciation, below cap)
run('Simple Payout', {
  claim: { claim_amount: 30000, asset_age_months: 0 },
  policy: { coverage_limit: 50000, deductible: 5000 },
  validation_result: { is_valid: true, rejection_reasons: [] }
});

// 3. Depreciation math running correctly
run('Appliance Depreciation', {
  claim: { claim_amount: 50000, asset_age_months: 24 }, // 2 years = 36%
  policy: { coverage_limit: 100000, deductible: 5000 },
  validation_result: { is_valid: true, rejection_reasons: [] }
});

// 4. Above Limits Cap
run('Capped by Policy Limit', {
  claim: { claim_amount: 250000, asset_age_months: 0 },
  policy: { coverage_limit: 100000, deductible: 10000 },
  validation_result: { is_valid: true, rejection_reasons: [] }
});

// 5. Total math resolves to exactly 0 after deductible
run('Zero Math Resolved', {
  claim: { claim_amount: 8000, asset_age_months: 12 }, // 18% loss -> 6560. Deductible 10000 -> 0.
  policy: { coverage_limit: 100000, deductible: 10000 },
  validation_result: { is_valid: true, rejection_reasons: [] }
});
