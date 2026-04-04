/**
 * PHASE 1 MIGRATION — Enterprise Insurance Platform Schema
 *
 * Execution order matters. ENUMs must be added BEFORE any ALTER TABLE
 * that references them. Postgres also prohibits adding ENUM values inside
 * a transaction block that was started implicitly, so every ALTER TYPE runs
 * in its own query call before the main block.
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function addEnumValue(type, value) {
  try {
    await pool.query(`ALTER TYPE ${type} ADD VALUE IF NOT EXISTS '${value}'`);
    console.log(`  ✔ ENUM ${type} <- '${value}'`);
  } catch (e) {
    console.log(`  ⚠  ENUM ${type} '${value}' already exists (skipping)`);
  }
}

async function migrate() {
  console.log('\n🚀 Phase 1 — Enterprise Schema Migration\n');

  // ─────────────────────────────────────────────────────────────────
  // STEP 1: Extend existing ENUMs (must run OUTSIDE a transaction block)
  // ─────────────────────────────────────────────────────────────────
  console.log('Step 1: Extending policy_status ENUM …');
  for (const v of ['draft', 'under_review', 'grace_period', 'cancelled', 'superseded']) {
    await addEnumValue('policy_status', v);
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 2: Create new ENUMs (safe inside DO blocks)
  // ─────────────────────────────────────────────────────────────────
  console.log('\nStep 2: Creating new ENUMs …');
  await pool.query(`
    DO $$ BEGIN
      CREATE TYPE coverage_type_enum AS ENUM (
        'rent_default',
        'property_damage',
        'appliance',
        'legal'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE trigger_condition_enum AS ENUM (
        'rent_delayed_30_days',
        'physical_damage_proven',
        'appliance_broken_not_wear_and_tear',
        'legal_dispute_filed'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE property_type_enum AS ENUM ('apartment', 'independent_house', 'other');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE furnishing_level_enum AS ENUM ('unfurnished', 'semi_furnished', 'fully_furnished');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE damage_classification_enum AS ENUM ('minor', 'moderate', 'severe');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  console.log('  ✔ coverage_type_enum');
  console.log('  ✔ trigger_condition_enum');
  console.log('  ✔ property_type_enum');
  console.log('  ✔ furnishing_level_enum');
  console.log('  ✔ damage_classification_enum');

  // ─────────────────────────────────────────────────────────────────
  // STEP 3: Alter Policies Table — Immutable Versioning
  // ─────────────────────────────────────────────────────────────────
  console.log('\nStep 3: Altering Policies table …');
  await pool.query(`
    ALTER TABLE Policies
      ADD COLUMN IF NOT EXISTS version_num         INTEGER  DEFAULT 1,
      ADD COLUMN IF NOT EXISTS previous_policy_id  UUID,
      ADD COLUMN IF NOT EXISTS policy_document_url TEXT;
  `);
  console.log('  ✔ version_num, previous_policy_id, policy_document_url');

  // ─────────────────────────────────────────────────────────────────
  // STEP 4: Create Coverages Table — Behavior-Driven
  // ─────────────────────────────────────────────────────────────────
  console.log('\nStep 4: Creating Coverages table …');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS Coverages (
      coverage_id        UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
      policy_id          UUID            NOT NULL REFERENCES Policies(policy_id) ON DELETE CASCADE,
      coverage_type      coverage_type_enum NOT NULL,
      trigger_condition  trigger_condition_enum NOT NULL,
      payout_limit       DECIMAL(10,2)   NOT NULL CHECK (payout_limit > 0),
      deductible         DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
      created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('  ✔ Coverages table created');

  // ─────────────────────────────────────────────────────────────────
  // STEP 5: Create Insured_Assets Table — Asset Declaration System
  // ─────────────────────────────────────────────────────────────────
  console.log('\nStep 5: Creating Insured_Assets table …');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS Insured_Assets (
      asset_id         UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
      policy_id        UUID            NOT NULL REFERENCES Policies(policy_id) ON DELETE CASCADE,
      item_type        VARCHAR(100)    NOT NULL,
      declared_value   DECIMAL(10,2)   NOT NULL CHECK (declared_value > 0),
      condition_status VARCHAR(50)     NOT NULL,
      proof_url        TEXT,
      created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('  ✔ Insured_Assets table created');

  // ─────────────────────────────────────────────────────────────────
  // STEP 6: Alter Risk_Assessments — Underwriting + Explainability
  // ─────────────────────────────────────────────────────────────────
  console.log('\nStep 6: Altering Risk_Assessments table …');
  await pool.query(`
    ALTER TABLE Risk_Assessments
      ADD COLUMN IF NOT EXISTS income_rent_ratio           DECIMAL(5,2),
      ADD COLUMN IF NOT EXISTS employment_stability_months INTEGER,
      ADD COLUMN IF NOT EXISTS probability_of_default      DECIMAL(5,4),
      ADD COLUMN IF NOT EXISTS reasoning                   JSONB DEFAULT '[]';
  `);
  console.log('  ✔ income_rent_ratio, employment_stability_months, probability_of_default, reasoning');

  // ─────────────────────────────────────────────────────────────────
  // STEP 7: Alter Properties — Asset Risk Factors
  // ─────────────────────────────────────────────────────────────────
  console.log('\nStep 7: Altering Properties table …');
  await pool.query(`
    ALTER TABLE Properties
      ADD COLUMN IF NOT EXISTS property_type    property_type_enum     DEFAULT 'apartment',
      ADD COLUMN IF NOT EXISTS furnishing_level furnishing_level_enum  DEFAULT 'unfurnished',
      ADD COLUMN IF NOT EXISTS security_features JSONB                 DEFAULT '[]';
  `);
  console.log('  ✔ property_type, furnishing_level, security_features');

  // ─────────────────────────────────────────────────────────────────
  // STEP 8: Alter Claims — P&C Payout Logic Columns
  // ─────────────────────────────────────────────────────────────────
  console.log('\nStep 8: Altering Claims table …');
  await pool.query(`
    ALTER TABLE Claims
      ADD COLUMN IF NOT EXISTS damage_classification  damage_classification_enum,
      ADD COLUMN IF NOT EXISTS calculated_payout      DECIMAL(10,2),
      ADD COLUMN IF NOT EXISTS depreciation_applied   DECIMAL(10,2)  DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS fraud_score            INTEGER        DEFAULT 0,
      ADD COLUMN IF NOT EXISTS adjudication_reasoning JSONB          DEFAULT '[]';
  `);
  console.log('  ✔ damage_classification, calculated_payout, depreciation_applied, fraud_score, adjudication_reasoning');

  // ─────────────────────────────────────────────────────────────────
  // STEP 9: Create Audit_Logs Table — Compliance
  // ─────────────────────────────────────────────────────────────────
  console.log('\nStep 9: Creating Audit_Logs table …');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS Audit_Logs (
      log_id      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type  VARCHAR(100) NOT NULL,
      user_id     UUID         REFERENCES Users(user_id) ON DELETE SET NULL,
      resource_id UUID,
      changes     JSONB,
      created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('  ✔ Audit_Logs table created');

  // ─────────────────────────────────────────────────────────────────
  // STEP 10: Create indexes for performance
  // ─────────────────────────────────────────────────────────────────
  console.log('\nStep 10: Creating indexes …');
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_coverages_policy        ON Coverages(policy_id);
    CREATE INDEX IF NOT EXISTS idx_insured_assets_policy   ON Insured_Assets(policy_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_event        ON Audit_Logs(event_type);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_resource     ON Audit_Logs(resource_id);
    CREATE INDEX IF NOT EXISTS idx_policies_version        ON Policies(previous_policy_id);
  `);
  console.log('  ✔ Indexes created');

  console.log('\n✅ Phase 1 Migration completed successfully!\n');
}

migrate()
  .catch((err) => {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
