// Migration script: Phase 1 Database Schema Updates
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log('Running Phase 1 Schema Migration...');
    
    await pool.query(`
      -- Policies Table Updates
      ALTER TABLE Policies 
          ADD COLUMN IF NOT EXISTS base_coverage_rent_months INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS base_coverage_damage_limit DECIMAL(10,2) DEFAULT 0.00,
          ADD COLUMN IF NOT EXISTS add_ons JSONB DEFAULT '[]',
          ADD COLUMN IF NOT EXISTS exclusions JSONB DEFAULT '[]',
          ADD COLUMN IF NOT EXISTS policy_document_url TEXT;

      -- Risk Assessments Table Updates
      ALTER TABLE Risk_Assessments
          ADD COLUMN IF NOT EXISTS income_rent_ratio DECIMAL(5,2),
          ADD COLUMN IF NOT EXISTS employment_stability_months INTEGER,
          ADD COLUMN IF NOT EXISTS probability_of_default DECIMAL(5,2);

      -- Custom Types for Properties
      DO $$ BEGIN
          CREATE TYPE property_type AS ENUM ('apartment', 'independent_house', 'other');
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
          CREATE TYPE furnishing_level AS ENUM ('unfurnished', 'semi_furnished', 'fully_furnished');
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;

      -- Properties Table Updates
      ALTER TABLE Properties
          ADD COLUMN IF NOT EXISTS property_type property_type DEFAULT 'apartment',
          ADD COLUMN IF NOT EXISTS furnishing_level furnishing_level DEFAULT 'unfurnished',
          ADD COLUMN IF NOT EXISTS security_features JSONB DEFAULT '[]';

      -- Custom Types for Claims
      DO $$ BEGIN
          CREATE TYPE damage_classification AS ENUM ('minor', 'moderate', 'severe');
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;

      -- Claims Table Updates
      ALTER TABLE Claims
          ADD COLUMN IF NOT EXISTS damage_classification damage_classification,
          ADD COLUMN IF NOT EXISTS fraud_score INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS adjudication_reason TEXT,
          ADD COLUMN IF NOT EXISTS adjudication_date TIMESTAMP WITH TIME ZONE;

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
    
    console.log('✅ Phase 1 Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    pool.end();
  }
}

migrate();
