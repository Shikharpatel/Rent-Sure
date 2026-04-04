/**
 * verify_claim_orchestration.js
 */

const { fileClaim } = require('./controllers/claimController');

// Mock Express req/res
const reqValid = {
  body: {
    claim_data: {
      claim_type: 'damage',
      damage_classification: 'moderate',
      claim_amount: 30000,
      days_since_policy_start: 200,
      asset: { age_months: 12 },
      tags: []
    },
    policy_data: {
      coverages: ['damage', 'rent_default'],
      exclusions: ['water_damage'],
      deductible: 5000,
      waiting_period: 30,
      coverage_limit: 100000
    }
  }
};

const reqInvalid = {
  body: {
    claim_data: {
      claim_type: 'appliance_cover', // missing base damage
      damage_classification: 'minor', // below threshold
      claim_amount: 15000,
      days_since_policy_start: 10, // cooling off violation + early fraud
      tags: []
    },
    policy_data: {
      coverages: ['appliance_cover'],
      exclusions: [],
      deductible: 0,
      waiting_period: 30,
      coverage_limit: 50000
    }
  }
};

const makeRes = (label) => ({
  status: function(code) { this.code = code; return this; },
  json: function(data) { 
    console.log(`\n--- ${label} ---`); 
    console.log(`ID: ${data.claim_id}`);
    console.log(`Valid: ${data.validation_result.is_valid}`);
    console.log(`Approved: ${data.adjudication_result.approved}`);
    console.log(`Payout: ${data.adjudication_result.calculated_payout}`);
    console.log(`Fraud Score: ${data.fraud_analysis.score}/100 [${data.fraud_analysis.risk_flag.toUpperCase()}]`);
    console.log(`State Transition: ${data.state.initial} -> ${data.state.current}`);
    console.log(`State Reasoning: ${data.state.state_reasoning}`);
  }
});

// Run Valid Payload
fileClaim(reqValid, makeRes('Perfect Valid Claim Pipeline'));

// Run Invalid Payload (Fails Validation -> No Payout -> Flags Early Fraud -> Rejected State)
fileClaim(reqInvalid, makeRes('Rejected & Flagged Claim Pipeline'));
