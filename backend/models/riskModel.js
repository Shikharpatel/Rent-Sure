const db = require('../config/db');

const RiskAssessment = {
    // Create a new risk assessment
    create: async (tenantId, riskScore, riskLevel) => {
        const query = `
      INSERT INTO Risk_Assessments (tenant_id, risk_score, risk_level)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
        const values = [tenantId, riskScore, riskLevel];
        const result = await db.query(query, values);
        return result.rows[0];
    },

    // Find the latest risk assessment for a tenant
    findByTenantId: async (tenantId) => {
        const query = `
      SELECT * FROM Risk_Assessments
      WHERE tenant_id = $1
      ORDER BY calculated_at DESC
      LIMIT 1;
    `;
        const result = await db.query(query, [tenantId]);
        return result.rows[0];
    },

    // Find all risk assessments for a tenant (history)
    findAllByTenantId: async (tenantId) => {
        const query = `
      SELECT * FROM Risk_Assessments
      WHERE tenant_id = $1
      ORDER BY calculated_at DESC;
    `;
        const result = await db.query(query, [tenantId]);
        return result.rows;
    }
};

module.exports = RiskAssessment;
