/**
 * verify_statemachine.js
 */

const { attemptTransition } = require('./services/LifecycleStateMachine');

function run(label, inputs) {
  const result = attemptTransition(inputs);
  console.log('\n---', label, '---');
  console.log(`Success?    ${result.success}`);
  if (result.success) {
    console.log(`Next State: ${result.next_state}`);
    console.log(`Reasoning:  ${result.reasoning}`);
  } else {
    console.log(`Error:      ${result.error}`);
    console.log(`Reasoning:  ${result.reasoning}`);
  }
}

// 1. Valid Policy Transitions
run('Valid Draft Submission', { entity_type: 'policy', current_state: 'draft', action: 'submit' });
run('Valid Active Expiration', { entity_type: 'policy', current_state: 'active', action: 'expire' });

// 2. Illegal Policy Transition
run('Illegal: Draft to Cancelled (Skipped Review)', { entity_type: 'policy', current_state: 'draft', action: 'cancel' });

// 3. Valid Claim Transitions
run('Valid Claim Validation', { entity_type: 'claim', current_state: 'filed', action: 'validate' });
run('Valid Claim Payout', { entity_type: 'claim', current_state: 'approved', action: 'pay' });

// 4. Illegal Claim Transitions
run('Illegal: Paying an unapproved claim', { entity_type: 'claim', current_state: 'filed', action: 'pay' });
run('Illegal: Attempting transition on Terminal state', { entity_type: 'claim', current_state: 'paid', action: 'validate' });

// 5. Invalid Entity or State inputs
run('Unknown Entity String', { entity_type: 'landlord_account', current_state: 'active', action: 'suspend' });
run('Unknown State String', { entity_type: 'policy', current_state: 'voided_in_database', action: 'submit' });
