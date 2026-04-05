const db = require('../config/db');

const Policy = {
    // Create a new policy
    create: async (tenantId, propertyId, premiumAmount, coverageAmount, startDate, expiryDate, coverageType) => {
        const query = `
      INSERT INTO Policies (tenant_id, property_id, premium_amount, coverage_amount, start_date, expiry_date, coverage_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
        const values = [tenantId, propertyId, premiumAmount, coverageAmount, startDate, expiryDate, coverageType || 'combined'];
        const result = await db.query(query, values);
        return result.rows[0];
    },

    // Find policies by tenant ID
    findByTenantId: async (tenantId) => {
        const query = `
      SELECT pol.*, p.address AS property_address, p.city AS property_city
      FROM Policies pol
      JOIN Properties p ON pol.property_id = p.property_id
      WHERE pol.tenant_id = $1
      ORDER BY pol.created_at DESC;
    `;
        const result = await db.query(query, [tenantId]);
        return result.rows;
    },

    // Find policies by property ID (for landlord view)
    findByPropertyId: async (propertyId) => {
        const query = `
      SELECT pol.*, u.name AS tenant_name, u.email AS tenant_email
      FROM Policies pol
      JOIN Users u ON pol.tenant_id = u.user_id
      WHERE pol.property_id = $1
      ORDER BY pol.created_at DESC;
    `;
        const result = await db.query(query, [propertyId]);
        return result.rows;
    },

    // Find active policy for double-insurance prevention
    findActiveByPropertyId: async (propertyId) => {
        const query = `
      SELECT * FROM Policies 
      WHERE property_id = $1 AND status IN ('active', 'pending');
    `;
        const result = await db.query(query, [propertyId]);
        return result.rows[0];
    },

    // Find policy by ID
    findById: async (policyId) => {
        const query = `
      SELECT pol.*, p.address AS property_address, p.city AS property_city,
             p.rent_amount AS property_rent_amount, u.name AS tenant_name
      FROM Policies pol
      JOIN Properties p ON pol.property_id = p.property_id
      JOIN Users u ON pol.tenant_id = u.user_id
      WHERE pol.policy_id = $1;
    `;
        const result = await db.query(query, [policyId]);
        return result.rows[0];
    },

    // Update policy status
    updateStatus: async (policyId, status) => {
        const query = `
      UPDATE Policies SET status = $1 WHERE policy_id = $2 RETURNING *;
    `;
        const result = await db.query(query, [status, policyId]);
        return result.rows[0];
    },

    // Get all pending policies (admin view)
    findAllPending: async () => {
        const query = `
      SELECT pol.*, p.address AS property_address, p.city AS property_city,
             u.name AS tenant_name
      FROM Policies pol
      JOIN Properties p ON pol.property_id = p.property_id
      JOIN Users u ON pol.tenant_id = u.user_id
      WHERE pol.status = 'under_review'
      ORDER BY pol.created_at ASC;
    `;
        const result = await db.query(query);
        return result.rows;
    },

    // Find policies linked to a landlord's properties
    findByLandlordId: async (landlordId) => {
        const query = `
      SELECT pol.*, p.address AS property_address, p.city AS property_city,
             u.name AS tenant_name
      FROM Policies pol
      JOIN Properties p ON pol.property_id = p.property_id
      JOIN Users u ON pol.tenant_id = u.user_id
      WHERE p.owner_id = $1
      ORDER BY pol.created_at DESC;
    `;
        const result = await db.query(query, [landlordId]);
        return result.rows;
    }
};

module.exports = Policy;
