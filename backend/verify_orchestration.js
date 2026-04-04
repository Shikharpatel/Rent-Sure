/**
 * verify_orchestration.js
 */

const { getPolicyQuote, createPolicy } = require('./controllers/policyController');

// Mock Express req/res
const req = {
  body: {
    tenant_data: {
      income: 120000,
      employment_months: 24,
      kyc_status: 'approved',
      prior_defaults: 0
    },
    property_data: {
      rent_amount: 30000,
      city: 'Pune',
      furnishing_level: 'semi_furnished'
    },
    coverages: {
      rent_default_months: 2,
      damage_cover_limit: 50000,
      deductible: 5000
    },
    add_ons: {
      appliance_cover: true
    }
  }
};

const resQuote = {
  status: function(code) { this.code = code; return this; },
  json: function(data) { console.log('\n--- quote response ---'); console.log(JSON.stringify(data, null, 2)); }
};

const resCreate = {
  status: function(code) { this.code = code; return this; },
  json: function(data) { console.log('\n--- async createPolicy response ---'); console.log(JSON.stringify(data, null, 2)); }
};

// Run Quote Orchestration
getPolicyQuote(req, resQuote);

// Run Create Policy Orchestration
createPolicy(req, resCreate);
