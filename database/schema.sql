-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- Enums for Statuses and Roles
-- ==========================================
CREATE TYPE user_role AS ENUM ('tenant', 'landlord', 'admin');
CREATE TYPE kyc_status AS ENUM ('pending', 'approved', 'rejected');
-- Expanded policy_status to match LifecycleStateMachine states
CREATE TYPE policy_status AS ENUM ('draft', 'under_review', 'active', 'grace_period', 'cancelled', 'superseded', 'expired');
CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed');
CREATE TYPE claim_status AS ENUM ('filed', 'validated', 'under_review', 'approved', 'rejected', 'paid');
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE damage_classification AS ENUM ('minor', 'moderate', 'severe');
CREATE TYPE trigger_condition AS ENUM ('physical_damage_proven', 'rent_default_confirmed', 'legal_dispute_filed', 'appliance_failure_verified');
CREATE TYPE furnishing_level AS ENUM ('unfurnished', 'semi_furnished', 'fully_furnished');
CREATE TYPE property_type AS ENUM ('apartment', 'independent_house', 'other');

-- ==========================================
-- Users Table
-- ==========================================
CREATE TABLE Users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- KYC Table
-- ==========================================
CREATE TABLE KYC (
    kyc_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    pan_number VARCHAR(20) UNIQUE NOT NULL,
    id_document_url TEXT NOT NULL,
    address TEXT NOT NULL,
    status kyc_status DEFAULT 'pending',
    verified_by UUID REFERENCES Users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- Properties Table
-- ==========================================
CREATE TABLE Properties (
    property_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    rent_amount DECIMAL(10, 2) NOT NULL CHECK (rent_amount > 0),
    estimated_deposit DECIMAL(10, 2) NOT NULL CHECK (estimated_deposit >= 0),
    building_year INTEGER,
    invite_code VARCHAR(20) UNIQUE,
    furnishing_level furnishing_level DEFAULT 'unfurnished',
    property_type property_type DEFAULT 'apartment',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- Policies Table (Immutable Versioning)
-- ==========================================
CREATE TABLE Policies (
    policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES Users(user_id) ON DELETE RESTRICT,
    property_id UUID NOT NULL REFERENCES Properties(property_id) ON DELETE RESTRICT,
    premium_amount DECIMAL(10, 2) NOT NULL CHECK (premium_amount > 0),
    coverage_amount DECIMAL(10, 2) NOT NULL CHECK (coverage_amount > 0),
    start_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    status policy_status DEFAULT 'draft',
    version_num INTEGER DEFAULT 1,
    previous_policy_id UUID REFERENCES Policies(policy_id) ON DELETE SET NULL,
    coverage_type VARCHAR(50) CHECK (coverage_type IN ('damage', 'rent_default', 'combined')),
    policy_document_url TEXT,    -- stores JSON underwriting audit data as serialized string
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (expiry_date > start_date)
);

-- ==========================================
-- Coverages Table (Behavior-Driven Coverage)
-- ==========================================
CREATE TABLE Coverages (
    coverage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES Policies(policy_id) ON DELETE CASCADE,
    coverage_type VARCHAR(50) NOT NULL,
    trigger_condition trigger_condition NOT NULL,
    payout_limit DECIMAL(10, 2) NOT NULL CHECK (payout_limit > 0),
    deductible DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- Asset Declarations Table
-- ==========================================
CREATE TABLE Asset_Declarations (
    asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES Policies(policy_id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    declared_value DECIMAL(10, 2) NOT NULL CHECK (declared_value > 0),
    condition_status VARCHAR(20) DEFAULT 'good' CHECK (condition_status IN ('new', 'good', 'fair', 'poor')),
    proof_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- Payments (Simulated) Table
-- ==========================================
CREATE TABLE Payments (
    payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES Policies(policy_id) ON DELETE RESTRICT,
    tenant_id UUID NOT NULL REFERENCES Users(user_id) ON DELETE RESTRICT,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status payment_status DEFAULT 'pending'
);

-- ==========================================
-- Claims Table
-- ==========================================
CREATE TABLE Claims (
    claim_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES Policies(policy_id) ON DELETE RESTRICT,
    landlord_id UUID NOT NULL REFERENCES Users(user_id) ON DELETE RESTRICT,
    description TEXT NOT NULL,
    evidence_url TEXT,                          -- legacy single URL
    evidence_urls TEXT[],                       -- multiple evidence items
    claim_amount DECIMAL(10, 2) NOT NULL CHECK (claim_amount > 0),
    damage_classification damage_classification,
    calculated_payout DECIMAL(10, 2) DEFAULT 0,
    fraud_score INTEGER DEFAULT 0,
    adjudication_reasoning TEXT,                -- JSON array of reasoning strings
    admin_notes TEXT,
    reviewed_by UUID REFERENCES Users(user_id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    status claim_status DEFAULT 'filed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- Risk Assessments Table
-- ==========================================
CREATE TABLE Risk_Assessments (
    risk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    risk_score INTEGER NOT NULL,
    risk_level risk_level NOT NULL,
    income_rent_ratio DECIMAL(5, 2),
    employment_stability_months INTEGER,
    probability_of_default DECIMAL(6, 4),
    reasoning JSONB,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
