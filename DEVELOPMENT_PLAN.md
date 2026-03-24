# Rent-Sure

Rent-Sure is a full-stack web application designed to replace traditional security deposits with a monthly protection plan. This repository contains the backend API and database schema. 

## What We Have Done So Far

### 1. Database Schema
A robust, normalized PostgreSQL schema (`database/schema.sql`) has been meticulously designed and implemented:
- **Custom Enums:** State management using enums like `user_role`, `kyc_status`, `policy_status`, `payment_status`, `claim_status`, and `risk_level`.
- **Core Entities:** Well-defined tables for `Users`, `KYC` (identity verification), `Properties`, `Policies`, `Payments`, `Claims`, and `Risk_Assessments` with strict schema-level constraints and efficient cascading logic.

### 2. Backend Server & Database Connection
- **Express Server (`backend/index.js`)**: A scalable Node.js/Express foundation running securely with standard JSON parsing middleware.
- **Connection Pool (`backend/config/db.js`)**: Robust PostgreSQL connection pooling using the `pg` library, configured securely via environment variables.
- **Health Verification (`GET /api/health`)**: An integration endpoint verifying active database connectivity seamlessly.

### 3. User Authentication & Authorization Flow
A fully operational, secure JWT-based authentication system:
- **Data Model (`backend/models/userModel.js`)**: Abstracted persistence layer mapping directly to the `Users` table.
- **Controllers (`backend/controllers/authController.js`)**: 
  - Complete registration (`POST /api/auth/register`) and login (`POST /api/auth/login`) logic.
  - Profile retrieval (`GET /api/auth/profile`).
  - Secure password hashing utilizing `bcrypt`.
- **Middleware (`backend/middleware/authMiddleware.js`)**: `generateToken` for structured JSON Web Tokens and `protect` middleware to parse the `Bearer` token and securely attach the authenticated user context to request lifecycles.

---

## Plan & Prompts to Complete the Project

The remainder of the backend work and the full frontend implementation will be broken down into incremental stages. You can copy and paste these detailed prompts one by one into our chat (or another AI assistant) to cleanly execute the rest of the project.

### Stage 1: KYC & Identity Verification
**Goal:** Build out the backend logic allowing users (especially tenants) to submit KYC details for verification before creating a policy.

> **Prompt for Stage 1:** 
> "Please implement the complete backend functionality for the KYC verification process in the Rent-Sure project. Create a `kycModel.js` to handle DB operations (create KYC, get KYC by user ID, update KYC status). Then, create a `kycController.js` and `kycRoutes.js` to expose endpoints for users to submit KYC details (PAN number, ID document URL, address) and for an admin/verifier to approve or reject the KYC. Ensure these routes are protected using our existing auth middleware."

### Stage 2: Properties & Tenant Risk Assessment
**Goal:** Allow landlords to list properties and implement a risk assessment simulation for tenants.

> **Prompt for Stage 2:**
> "Please implement the Properties and Risk Assessment backend modules for Rent-Sure. Create models, controllers, and protected route files (`propertyRoutes.js`) for Landlords to add, edit, and view their listed `Properties`. Additionally, create an endpoint replicating a 'Risk Assessment' (`riskRoutes.js`) that automatically generates a `risk_score` for a tenant when they apply for a property, storing it in the `Risk_Assessments` table."

### Stage 3: Core Business Logic (Policies, Payments, Claims)
**Goal:** Build the core logic of generating protection policies, processing simulated payments, and allowing landlords to file claims.

> **Prompt for Stage 3:**
> "Please build the core financial APIs for the Rent-Sure backend. First, create a `Policies` module allowing a tenant to purchase a security deposit replacement policy for a specific property. Second, create a `Payments` module to simulate monthly premium transactions. Finally, build a `Claims` module allowing landlords to file a claim against a policy and admins to process it. Ensure all routes enforce role-based access control (e.g., only landlords can interact with claims, only tenants can pay premiums)."

### Stage 4: Premium Frontend Scaffolding & Design System
**Goal:** Set up a React/Vite (or Next.js) frontend architecture featuring a bespoke, high-end visual design.

> **Prompt for Stage 4:**
> "We are starting the Rent-Sure frontend web application. Let's create a stunning, award-winning interface. Initialize the project using Vite+React. Before adding complex routing, build out a breathtaking, visually dynamic landing page that looks and feels like a top-tier Fintech startup. 
> 
> **CRITICAL**: Do NOT use generic, standard AI-looking templates, flat Bootstrap styles, or plain, blocky Tailwind defaults. I want a bespoke, dynamic user interface utilizing elegant typography (like 'Inter' for body, 'Playfair Display' for headers), a deep dark mode with dynamic, vibrant gradients (e.g., violet/cyan accents), glassmorphism components, and highly polished micro-animations (hover states, subtle page load reveals). Focus strictly on rich aesthetics for this phase with vanilla CSS or heavily customized tooling."

### Stage 5: Frontend Integration (Dashboards & Auth)
**Goal:** Connect the frontend to our backend API, building out distinct, personalized dashboards for Tenants and Landlords.

> **Prompt for Stage 5:**
> "Now let's connect our Rent-Sure frontend to our implemented backend API. Build the authentication views (Login & Register) making sure they adhere tightly to our premium, high-aesthetic design system with smooth transitions and clear, elegant error handling. Once authenticated, route the user to either a secure 'Tenant Dashboard' or 'Landlord Dashboard' depending on the fetched user role. 
> 
> The Tenant dashboard should beautifully visualize their active protection policies and monthly rent payment history using subtle charts or polished cards. The Landlord dashboard should elegantly display their listed properties, active tenant policies across them, and an intuitive form section to file a claim. Ensure the entire experience feels snappy, professional, and visually compelling."
