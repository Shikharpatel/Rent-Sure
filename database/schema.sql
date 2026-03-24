-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- Enums for Statuses and Roles
-- ==========================================
CREATE TYPE user_role AS ENUM ('tenant', 'landlord', 'admin');
CREATE TYPE kyc_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE policy_status AS ENUM ('pending', 'active', 'expired', 'rejected');
CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed');
CREATE TYPE claim_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high');

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- Policies Table
-- ==========================================
CREATE TABLE Policies (
    policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES Users(user_id) ON DELETE RESTRICT,
    property_id UUID NOT NULL REFERENCES Properties(property_id) ON DELETE RESTRICT,
    premium_amount DECIMAL(10, 2) NOT NULL CHECK (premium_amount > 0),
    coverage_amount DECIMAL(10, 2) NOT NULL CHECK (coverage_amount > 0),
    start_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    status policy_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    coverage_type VARCHAR(50) CHECK (coverage_type IN ('damage', 'rent_default', 'combined')),
    CHECK (expiry_date > start_date)
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
    evidence_url TEXT,
    claim_amount DECIMAL(10, 2) NOT NULL CHECK (claim_amount > 0),
    status claim_status DEFAULT 'pending',
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
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
