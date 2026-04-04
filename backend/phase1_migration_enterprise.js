// Migration script: Phase 1 Enterprise Database Schema Updates
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log('Running Phase 1 Enterprise Schema Migration...');
    
    // Postgres doesn't allow ALTER TYPE inside a transaction block easily, 
    // so we execute ENUM additions directly first.
    let statusEnums = ['grace_period', 'cancelled', 'superseded', 'draft'];
    for (let status of statusEnums) {
        try {
            await pool.query(`ALTER TYPE policy_status ADD VALUE IF NOT EXISTS '${status}'`);
        } catch (e) {
            // Might already exist
        }
    }

    await pool.query(`
      -- Policies Table Updates
      ALTER TABLE Policies 
          ADD COLUMN IF NOT EXISTS version_num INTEGER DEFAULT 1,
          ADD COLUMN IF NOT EXISTS parent_policy_id UUID, -- self reference to supersession
          ADD COLUMN IF NOT EXISTS policy_document_url TEXT;

      -- Coverages Enum & Table
      DO $$ BEGIN
          CREATE TYPE coverage_type_enum AS ENUM ('rent_default', 'property_damage', 'appliance', 'legal');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
          CREATE TYPE trigger_condition_enum AS ENUM ('rent_delayed_30_days', 'physical_damage_proven', 'appliance_broken_not_wear_and_tear', 'legal_dispute_filed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      CREATE TABLE IF NOT EXISTS Coverages (
          coverage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          policy_id UUID NOT NULL REFERENCES Policies(policy_id) ON DELETE CASCADE,
          type coverage_type_enum NOT NULL,
          trigger_condition trigger_condition_enum NOT NULL,
          payout_limit DECIMAL(10,2) NOT NULL,
          dependency_rules JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Asset Declarations Table
      CREATE TABLE IF NOT EXISTS Asset_Declarations (
          asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          policy_id UUID NOT NULL REFERENCES Policies(policy_id) ON DELETE CASCADE,
          description TEXT NOT NULL,
          declared_value DECIMAL(10,2) NOT NULL,
          condition_status VARCHAR(50) NOT NULL,
          proof_url TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Risk Assessments Table Updates
      ALTER TABLE Risk_Assessments
          ADD COLUMN IF NOT EXISTS income_rent_ratio DECIMAL(5,2),
          ADD COLUMN IF NOT EXISTS employment_stability_months INTEGER,
          ADD COLUMN IF NOT EXISTS probability_of_default DECIMAL(5,2),
          ADD COLUMN IF NOT EXISTS reasoning JSONB DEFAULT '[]';

      -- Properties Enum & Table Updates
      DO $$ BEGIN
          CREATE TYPE property_type AS ENUM ('apartment', 'independent_house', 'other');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
          CREATE TYPE furnishing_level AS ENUM ('unfurnished', 'semi_furnished', 'fully_furnished');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      ALTER TABLE Properties
          ADD COLUMN IF NOT EXISTS property_type property_type DEFAULT 'apartment',
          ADD COLUMN IF NOT EXISTS furnishing_level furnishing_level DEFAULT 'unfurnished',
          ADD COLUMN IF NOT EXISTS security_features JSONB DEFAULT '[]';

      -- Claims Enum & Table Updates
      DO $$ BEGIN
          CREATE TYPE damage_classification AS ENUM ('minor', 'moderate', 'severe');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      ALTER TABLE Claims
          ADD COLUMN IF NOT EXISTS damage_classification damage_classification,
          ADD COLUMN IF NOT EXISTS calculated_payout DECIMAL(10,2),
          ADD COLUMN IF NOT EXISTS depreciation_applied DECIMAL(10,2),
          ADD COLUMN IF NOT EXISTS fraud_score INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS adjudication_reasoning TEXT;

      -- Create Audit Logs Table
      CREATE TABLE IF NOT EXISTS Audit_Logs (
          log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_type VARCHAR(100) NOT NULL,
          user_id UUID REFERENCES Users(user_id) ON DELETE SET NULL,
          resource_id UUID,
          changes JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✅ Enterprise Phase 1 Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    pool.end();
  }
}

migrate();
