const db = require('../config/db');

const Payment = {
    // Create a new payment record
    create: async (policyId, tenantId, amount) => {
        const query = `
      INSERT INTO Payments (policy_id, tenant_id, amount, status)
      VALUES ($1, $2, $3, 'success')
      RETURNING *;
    `;
        const values = [policyId, tenantId, amount];
        const result = await db.query(query, values);
        return result.rows[0];
    },

    // Find all payments for a specific policy
    findByPolicyId: async (policyId) => {
        const query = `
      SELECT * FROM Payments
      WHERE policy_id = $1
      ORDER BY payment_date DESC;
    `;
        const result = await db.query(query, [policyId]);
        return result.rows;
    },

    // Find all payments made by a tenant
    findByTenantId: async (tenantId) => {
        const query = `
      SELECT pay.*, pol.property_id
      FROM Payments pay
      JOIN Policies pol ON pay.policy_id = pol.policy_id
      WHERE pay.tenant_id = $1
      ORDER BY pay.payment_date DESC;
    `;
        const result = await db.query(query, [tenantId]);
        return result.rows;
    },

    // Get total payments for a policy
    getTotalByPolicyId: async (policyId) => {
        const query = `SELECT COALESCE(SUM(amount), 0) AS total FROM Payments WHERE policy_id = $1 AND status = 'success'`;
        const result = await db.query(query, [policyId]);
        return parseFloat(result.rows[0].total);
    }
};

module.exports = Payment;
