/**
 * verify_fraud.js
 */

const { detectFraud } = require('./services/FraudDetector');

function run(label, claim, policy) {
  const result = detectFraud({ claim, policy });
  console.log('\n---', label, '---');
  console.log(`Score: ${result.fraud_score}/100 | Risk: ${result.risk_flag.toUpperCase()}`);
  console.log('Reasons:');
  result.reasons.forEach(r => console.log('  >', r));
}

// 1. Clean Claim (No flags)
run('Clean Standard Claim',
  { claim_amount: 15000, days_since_policy_start: 200, claim_frequency: 0, declared_asset_value: 20000 },
  { coverage_limit: 50000 }
);

// 2. Early Claim Only (35 pts -> Medium)
run('Early Claim (Ghosting Suspicion)',
  { claim_amount: 10000, days_since_policy_start: 10, claim_frequency: 0 },
  { coverage_limit: 50000 }
);

// 3. Over-claiming (40 pts) + Maxing Out Limit (20 pts) -> 60 pts Medium
run('Over-claiming + Limit Maxing',
  { claim_amount: 48000, days_since_policy_start: 150, claim_frequency: 0, declared_asset_value: 20000 },
  { coverage_limit: 50000 }
);

// 4. Repeated Abuse: Frequency (2 * 25 = 50) + Early(35) -> 85 High Risk
run('Repeated Abuse',
  { claim_amount: 15000, days_since_policy_start: 30, claim_frequency: 2 },
  { coverage_limit: 50000 }
);

// 5. Ultimate Nightmare Claim (Hits > 100, checking clamping)
run('All Flags Hit (Clamp Check)',
  { claim_amount: 100000, days_since_policy_start: 5, claim_frequency: 4, declared_asset_value: 10000 },
  { coverage_limit: 100000 }
);
