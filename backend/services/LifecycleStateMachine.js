/**
 * LifecycleStateMachine.js
 *
 * Purpose: Guard service that explicitly controls valid state transitions.
 * Role   : Pure finite state machine. Does not perform business math.
 *
 * Canonical Output:
 * {
 *   success: boolean,
 *   next_state: string | null,
 *   error: string | null,
 *   reasoning: string
 * }
 */

// ─────────────────────────────────────────────────────────────────────────────
// Transition Definition Matrices
// ─────────────────────────────────────────────────────────────────────────────

const STATE_MACHINES = {
  policy: {
    draft: {
      submit: 'under_review'
    },
    under_review: {
      approve: 'active',
      reject: 'cancelled' // Logical implicit addition
    },
    active: {
      miss_payment: 'grace_period',
      expire: 'expired',
      amend: 'superseded'
    },
    grace_period: {
      recover_payment: 'active', // Essential logical return path
      cancel: 'cancelled'
    },
    // Terminal states have no outbound transitions
    cancelled: {},
    expired: {},
    superseded: {}
  },

  claim: {
    filed: {
      validate: 'validated',
      reject_early: 'rejected' // Logical early-out
    },
    validated: {
      review: 'under_review',
      reject_early: 'rejected'
    },
    under_review: {
      approve: 'approved',
      reject: 'rejected'
    },
    approved: {
      pay: 'paid'
    },
    // Terminal states
    rejected: {},
    paid: {}
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempts to transition an entity's lifecycle state.
 *
 * @param {object} inputs
 * @param {string} inputs.entity_type - 'policy' or 'claim'
 * @param {string} inputs.current_state - Current status column value
 * @param {string} inputs.action - The event attempting to trigger a transition
 *
 * @returns {object} Transition result
 */
function attemptTransition(inputs = {}) {
  const { entity_type, current_state, action } = inputs;

  const validTypes = Object.keys(STATE_MACHINES);

  // 1. Guard: Validate Entity Type
  if (!entity_type || !validTypes.includes(entity_type.toLowerCase())) {
    return {
      success: false,
      next_state: null,
      error: `Invalid entity_type. Must be one of: [${validTypes.join(', ')}]`,
      reasoning: `Transition failed. Unknown entity '${entity_type}'.`
    };
  }

  const type = entity_type.toLowerCase();
  const machine = STATE_MACHINES[type];

  // 2. Guard: Validate Current State
  if (!current_state || !machine[current_state.toLowerCase()]) {
    return {
      success: false,
      next_state: null,
      error: `Invalid current_state. State '${current_state}' does not exist on entity '${type}'.`,
      reasoning: `Transition failed. Entity cannot originate from unknown state.`
    };
  }

  const state = current_state.toLowerCase();
  const allowedTransitions = machine[state];

  // 3. Guard: Validate Action & Execute
  if (!action) {
    return {
      success: false,
      next_state: null,
      error: `Action parameter is required to attempt a transition.`,
      reasoning: `Transition failed. No action requested.`
    };
  }

  const act = action.toLowerCase();
  const nextState = allowedTransitions[act];

  if (!nextState) {
    // Collect allowed actions for helpful error messaging
    const validActions = Object.keys(allowedTransitions);
    const optionsStr = validActions.length > 0 
      ? `Allowed actions from '${state}' are: [${validActions.join(', ')}].` 
      : `'${state}' is a terminal state. No further transitions allowed.`;

    return {
      success: false,
      next_state: null,
      error: `Illegal transition. Action '${act}' is not permitted from state '${state}'.`,
      reasoning: `Transition blocked. ${optionsStr}`
    };
  }

  return {
    success: true,
    next_state: nextState,
    error: null,
    reasoning: `[TRANSITION] ${type.toUpperCase()} safely moved from '${state}' to '${nextState}' via action '${act}'.`
  };
}

module.exports = { attemptTransition, STATE_MACHINES };
