/**
 * verify_behavior.js
 */

const { validateClaim } = require('./services/CoverageBehaviorEngine');

function run(label, claim, policy) {
  const result = validateClaim({ claim, policy });
  console.log('\n---', label, '---');
  console.log('Valid?     ', result.is_valid);
  console.log('Summary    ', result.validation_summary);
  if (!result.is_valid) {
    result.rejection_reasons.forEach(r => console.log('  [Reject] ', r));
  }
}

// 1. Valid Claim
run('Valid Damage Claim',
  { claim_type: 'damage', damage_classification: 'moderate', claim_amount: 50000, days_since_policy_start: 90, tags: [] },
  { coverages: ['damage', 'rent_default'], exclusions: ['water_damage'], deductible: 5000, waiting_period: 30 }
);

// 2. Waiting period violation
run('Cooling Off Violation',
  { claim_type: 'damage', damage_classification: 'moderate', claim_amount: 50000, days_since_policy_start: 15, tags: [] },
  { coverages: ['damage'], exclusions: [], deductible: 0, waiting_period: 30 }
);

// 3. Exclusion match
run('Exclusion Hit',
  { claim_type: 'damage', damage_classification: 'severe', claim_amount: 80000, days_since_policy_start: 200, tags: ['water_damage'] },
  { coverages: ['damage'], exclusions: ['water_damage', 'pets'], deductible: 5000, waiting_period: 30 }
);

// 4. Missing Coverage
run('Missing Coverage',
  { claim_type: 'rent_default', claim_amount: 25000, days_since_policy_start: 150, tags: [] },
  { coverages: ['damage'], exclusions: [], deductible: 0, waiting_period: 30 }
);

// 5. Dependency Violation
run('Dependency Validation',
  { claim_type: 'appliance_cover', damage_classification: 'moderate', claim_amount: 15000, days_since_policy_start: 120, tags: [] },
  { coverages: ['appliance_cover'], exclusions: [], deductible: 0, waiting_period: 30 } // missing 'damage' core coverage
);

// 6. Minor Damage Trigger rules
run('Trigger Severity Rules',
  { claim_type: 'damage', damage_classification: 'minor', claim_amount: 10000, days_since_policy_start: 180, tags: [] },
  { coverages: ['damage'], exclusions: [], deductible: 0, waiting_period: 30 }
);

// 7. Below Deductible
run('Below Deductible',
  { claim_type: 'damage', damage_classification: 'moderate', claim_amount: 4000, days_since_policy_start: 100, tags: [] },
  { coverages: ['damage'], exclusions: [], deductible: 5000, waiting_period: 30 }
);

// 8. Multiple Violations
run('Multiple Violations',
  { claim_type: 'appliance_cover', damage_classification: 'minor', claim_amount: 4000, days_since_policy_start: 10, tags: ['water_damage'] },
  { coverages: ['appliance_cover'], exclusions: ['water_damage'], deductible: 5000, waiting_period: 30 }
);
