-- Migration: Claims Evidence Viewer + Admin Notes
-- Run this once against the live Neon DB if these columns don't exist yet.
-- All statements use IF NOT EXISTS / idempotent patterns — safe to re-run.

ALTER TABLE Claims ADD COLUMN IF NOT EXISTS evidence_urls TEXT[];
ALTER TABLE Claims ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE Claims ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES Users(user_id) ON DELETE SET NULL;
ALTER TABLE Claims ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE Claims ADD COLUMN IF NOT EXISTS damage_classification VARCHAR(20);
ALTER TABLE Claims ADD COLUMN IF NOT EXISTS calculated_payout DECIMAL(10,2) DEFAULT 0;
ALTER TABLE Claims ADD COLUMN IF NOT EXISTS fraud_score INTEGER DEFAULT 0;
ALTER TABLE Claims ADD COLUMN IF NOT EXISTS adjudication_reasoning TEXT;

-- Properties: furnishing level + property type + invite code
ALTER TABLE Properties ADD COLUMN IF NOT EXISTS invite_code VARCHAR(20) UNIQUE;
ALTER TABLE Properties ADD COLUMN IF NOT EXISTS furnishing_level VARCHAR(30) DEFAULT 'unfurnished';
ALTER TABLE Properties ADD COLUMN IF NOT EXISTS property_type VARCHAR(30) DEFAULT 'apartment';

-- Policies: audit data column + version tracking
ALTER TABLE Policies ADD COLUMN IF NOT EXISTS policy_document_url TEXT;
ALTER TABLE Policies ADD COLUMN IF NOT EXISTS version_num INTEGER DEFAULT 1;
ALTER TABLE Policies ADD COLUMN IF NOT EXISTS previous_policy_id UUID REFERENCES Policies(policy_id) ON DELETE SET NULL;
