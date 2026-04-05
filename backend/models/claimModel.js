const db = require('../config/db');

const Claim = {
    // Create a new claim
    create: async (policyId, landlordId, description, evidenceUrl, claimAmount) => {
        const query = `
      INSERT INTO Claims (policy_id, landlord_id, description, evidence_url, claim_amount)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
        const values = [policyId, landlordId, description, evidenceUrl || null, claimAmount];
        const result = await db.query(query, values);
        return result.rows[0];
    },

    // Find claims by landlord
    findByLandlordId: async (landlordId) => {
        const query = `
      SELECT c.*, pol.property_id, p.address AS property_address
      FROM Claims c
      JOIN Policies pol ON c.policy_id = pol.policy_id
      JOIN Properties p ON pol.property_id = p.property_id
      WHERE c.landlord_id = $1
      ORDER BY c.created_at DESC;
    `;
        const result = await db.query(query, [landlordId]);
        return result.rows;
    },

    // Find claim by ID
    findById: async (claimId) => {
        const query = `
      SELECT c.*, pol.property_id, p.address AS property_address,
             u.name AS landlord_name
      FROM Claims c
      JOIN Policies pol ON c.policy_id = pol.policy_id
      JOIN Properties p ON pol.property_id = p.property_id
      JOIN Users u ON c.landlord_id = u.user_id
      WHERE c.claim_id = $1;
    `;
        const result = await db.query(query, [claimId]);
        return result.rows[0];
    },

    // Update claim status (admin approve/reject) — with notes + reviewer audit trail
    review: async (claimId, status, adminNotes, reviewedBy) => {
        const query = `
      UPDATE Claims
      SET status = $1, admin_notes = $2, reviewed_by = $3,
          reviewed_at = NOW(), updated_at = NOW()
      WHERE claim_id = $4
      RETURNING *;
    `;
        const result = await db.query(query, [status, adminNotes || null, reviewedBy, claimId]);
        return result.rows[0];
    },

    // Legacy: update status only (kept for backward compatibility)
    updateStatus: async (claimId, status) => {
        const query = `
      UPDATE Claims
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE claim_id = $2
      RETURNING *;
    `;
        const result = await db.query(query, [status, claimId]);
        return result.rows[0];
    },

    // Get all pending claims (admin view)
    findAllPending: async () => {
        const query = `
      SELECT c.*, pol.property_id, p.address AS property_address,
             u.name AS landlord_name
      FROM Claims c
      JOIN Policies pol ON c.policy_id = pol.policy_id
      JOIN Properties p ON pol.property_id = p.property_id
      JOIN Users u ON c.landlord_id = u.user_id
      WHERE c.status = 'under_review'
      ORDER BY c.created_at ASC;
    `;
        const result = await db.query(query);
        return result.rows;
    }
};

module.exports = Claim;
