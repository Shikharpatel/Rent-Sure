/**
 * CoverageBehaviorEngine.js
 *
 * Purpose: Validates whether a claim is eligible under a specific policy.
 * Role   : Pure decision engine (Boolean gatekeeper). Does NOT calculate payouts.
 *
 * Validation Flow:
 * 1. Waiting Period Check: Reject if claim filed too soon after policy inception.
 * 2. Coverage Check: Reject if the requested claim_type is not active on the policy.
 * 3. Exclusion Check: Reject if the claim matches any explicit policy exclusions.
 * 4. Dependency Check: Reject if the coverage requires a base coverage that is missing.
 * 5. Trigger Condition Check: Reject if the severity/conditions do not meet the minimum bar.
 *
 * Canonical Output:
 * {
 *   is_valid: boolean,
 *   rejection_reasons: string[],
 *   validation_summary: string
 * }
 */

// ─────────────────────────────────────────────────────────────────────────────
// Hardcoded business trigger rules (acting as the Policy Wording contract)
// ─────────────────────────────────────────────────────────────────────────────

const MIN_DAMAGE_SEVERITY = ['moderate', 'severe'];

// ─────────────────────────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a claim against a policy's rules.
 *
 * @param {object} inputs
 * @param {object} inputs.claim
 * @param {string} inputs.claim.claim_type            - 'damage' | 'rent_default' | 'appliance_cover' ...
 * @param {string} inputs.claim.damage_classification - 'minor' | 'moderate' | 'severe'
 * @param {number} inputs.claim.claim_amount          - Claimed value in INR
 * @param {number} inputs.claim.days_since_policy_start - Integer days
 * @param {object} inputs.policy
 * @param {string[]} inputs.policy.coverages          - e.g. ['rent_default', 'damage', 'appliance_cover']
 * @param {string[]} inputs.policy.exclusions         - e.g. ['water_damage', 'wear_and_tear']
 * @param {number} inputs.policy.deductible           - INR value
 * @param {number} inputs.policy.waiting_period       - Integer days policy must age before a claim is valid
 *
 * @returns {object} Validation result
 */
function validateClaim(inputs = {}) {
  const { claim = {}, policy = {} } = inputs;
  const {
    claim_type,
    damage_classification,
    claim_amount = 0,
    days_since_policy_start = 0,
    tags = [] // Tags representing claim features (e.g., ['water_damage'])
  } = claim;

  const {
    coverages = [],
    exclusions = [],
    deductible = 0,
    waiting_period = 30 // standard 30 day cooling off
  } = policy;

  const rejection_reasons = [];

  // 1. Waiting Period Check
  if (days_since_policy_start < waiting_period) {
    rejection_reasons.push(
      `Claim filed ${days_since_policy_start} days after inception. Policy has a strict ${waiting_period}-day waiting period.`
    );
  }

  // 2. Coverage Existence Check
  if (!claim_type || !coverages.includes(claim_type)) {
    rejection_reasons.push(
      `Policy does not include coverage for '${claim_type || 'unknown'}'. Active coverages: [${coverages.join(', ')}]`
    );
  }

  // 3. Exclusion Check
  // Compare claim tags against policy exclusions
  const matchedExclusions = tags.filter(tag => exclusions.includes(tag));
  if (matchedExclusions.length > 0) {
    rejection_reasons.push(
      `Claim rejected under explicit exclusions: [${matchedExclusions.join(', ')}]`
    );
  }

  // 4. Dependency Rules
  if (claim_type === 'appliance_cover' && !coverages.includes('damage')) {
    rejection_reasons.push(
      `'appliance_cover' requires base 'damage' coverage on the policy.`
    );
  }

  // 5. Trigger Conditions
  if (['damage', 'appliance_cover'].includes(claim_type)) {
    if (!damage_classification || !MIN_DAMAGE_SEVERITY.includes(damage_classification)) {
      rejection_reasons.push(
        `Damage validation failed. Classification is '${damage_classification || 'none'}', but must be 'moderate' or 'severe'. Minor wear and tear is excluded.`
      );
    }
  }

  if (claim_amount > 0 && claim_amount <= deductible) {
    rejection_reasons.push(
      `Claim amount Rs.${claim_amount} is less than or equal to the policy deductible of Rs.${deductible}. No payout is possible.`
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Result Assembly
  // ─────────────────────────────────────────────────────────────────────────────
  const is_valid = rejection_reasons.length === 0;

  let validation_summary;
  if (is_valid) {
    validation_summary = `Claim for '${claim_type}' is valid and meets all policy trigger conditions.`;
  } else {
    validation_summary = `Claim rejected. Triggered ${rejection_reasons.length} rule violation(s).`;
  }

  return {
    is_valid,
    rejection_reasons,
    validation_summary
  };
}

module.exports = { validateClaim };
