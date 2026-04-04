# Final Implementation Plan: Enterprise Rental Insurance Platform

This document outlines the architectural and engineering steps required to transform the system into an industry-grade **Rental Insurance Platform (Deposit Replacement System)** modeled on enterprise architectures like Guidewire.

## Phase 1: Database Schema Evolution (The Foundation)

We must modify the current database schema (`database/schema.sql`) to support structured insurance products, immutable versioning, asset declarations, and state machines.

### [MODIFY] `database/schema.sql`

1.  **Refine `Policies` Table (Immutable Versioning):**
    *   **[NEW]** Add `version_num` (INTEGER) and `previous_policy_id` (UUID). *Requirement: Policies are immutable contracts. Updates create a new version and preserve legal history.*
    *   **[NEW]** Update `policy_status` ENUM for Explicit State Transitions: `draft`, `under_review`, `active`, `grace_period`, `cancelled`, `superseded`, `expired`.
2.  **[NEW] Create `Coverages` Table (Behavior-Driven Coverage Modeling):**
    *   Coverage is no longer a JSON label; it is relational behavior.
    *   Columns: `coverage_id`, `policy_id`, `coverage_type`, `trigger_condition` (ENUM), `payout_limit` (DECIMAL), `deductible` (DECIMAL).
3.  **[NEW] Create `Insured_Assets` Table (Asset Declaration System):**
    *   Columns: `asset_id`, `policy_id`, `item_type`, `declared_value`, `condition_status`, `proof_url`, `created_at`.
4.  **Refine `Risk_Assessments` Table (Underwriting):**
    *   Add `income_rent_ratio` (DECIMAL), `employment_stability_months` (INTEGER), `probability_of_default` (DECIMAL).
    *   **[NEW]** Add `reasoning` (JSONB) to output the "WHY" (Explainability Layer).
5.  **Refine `Properties` Table (Asset Risk):**
    *   Add `property_type`, `furnishing_level`, and `security_features`.
6.  **Refine `Claims` Table (P&C Payout Features):**
    *   Add `damage_classification` (ENUM: minor, moderate, severe).
    *   **[NEW]** Add `calculated_payout` (DECIMAL), `depreciation_applied` (DECIMAL), and `fraud_score` (INTEGER).
    *   **[NEW]** Add `adjudication_reasoning` (JSONB).

---

## Phase 2: Core Insurance Engine Services

We will abstract heavy business logic into dedicated Engine Service classes handling deterministic logic.

### `backend/services/UnderwritingEngine.js`
*   **Logic:** Ingests Income, KYC, Employment stability, and rental history.
*   **[NEW] Explainability Output:** Returns an array of human-readable decisions (e.g., `["+10 risk due to <6 month employment", "-5 risk due to prime city location"]`).

### `backend/services/PricingEngine.js`
*   **Logic:** Multiplies Property Risk, Base Coverages, and Tenant Risk.
*   **[NEW] Explainability Output:** Breakdown matrix (e.g., `"Base Coverage = ₹200, Property Furnished surcharge = ₹50, High Risk Multiplier = 1.2x -> Final ₹300"`).

### **[NEW]** `backend/services/CoverageBehaviorEngine.js`
*   **Purpose:** Enforces behavior deeply.
*   **Logic:** Determines IF a claim is valid based on exact rules (e.g., "Damage is payable ONLY IF classification is moderate/severe AND not explicitly excluded").

### `backend/services/ClaimsAdjudicator.js`
*   **[NEW] Claim Payout Logic (Math):**
    *   Calculates exact payout.
    *   Applies **Depreciation** based on `Insured_Assets` age (e.g., Appliance age > 1 year reduces payout by 20%).
    *   Caps the total payout strictly by the `Coverages.payout_limit`.
*   **Output:** `calculated_payout` and detailed `adjudication_reasoning`.

### `backend/services/FraudDetector.js`
*   Flags claims filed < 30 days after policy inception, or repeated claims. Cross-references declared asset value vs claim value.

---

## Phase 3: Route & Controller Updates & State Management

### **[NEW]** `backend/services/LifecycleStateMachine.js`
*   **Purpose:** Strict rule processor for Entity Transitions.
*   **Policy Logic:** Defines transition guarantees: `Draft` → `Under Review` → `Active` → `Expired`.
*   **Claims Logic:** `Filed` → `Validated` → `Approved/Rejected` → `Paid`.

### **[NEW]** Payment Dependency Logic
*   Payment webhooks directly invoke the Lifecycle Machine:
    *   No payment -> Policy remains `Inactive`.
    *   Payment failed -> Policy enters `grace_period` (7 days).
    *   Repeated failure -> Policy shifts to `cancelled`.

### `backend/controllers/policyController.js`
*   **Creation:** Upgraded to receive `Insured_Assets` payload.
*   **Amendments:** API to update policies executing the **Immutable Versioning Strategy** (marking old `superseded`, creating a new `draft` inheriting history).

---

## Phase 4: Frontend Upgrades (The Explainable Platform UI)

### `frontend/src/pages/TenantDashboard.jsx`
*   **[NEW] Quote Explainability:** The UI explicitly displays the Reasoning Breakdown array from the Engines, so users see exactly why their premium is priced the way it is.
*   **[NEW] Asset Declaration Flow:** For "Appliance/Furniture Cover", tenants must fill a multi-step form to declare item value, condition, and upload image proofs before quoting.

### `frontend/src/pages/LandlordDashboard.jsx`  (or Admin Panel)
*   **[NEW] Adjudication Review:** Clear breakdown of the Adjudicator's math (Claimed Amount vs Depreciation vs Coverage Cap vs Final Approved Check) and the reasoning string.
*   **[NEW] Advanced Analytics Segmentation:** Granular dashboards replacing global metrics.
    *   Loss Ratio by City.
    *   Loss Ratio by Risk Level (e.g., checking if High-Risk cohorts are actually unprofitable).
    *   Loss Ratio by Coverage Type (Appliance vs Rent).
