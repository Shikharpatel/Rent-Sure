const db = require('../config/db');

const KYC = {
    // Submit a new KYC record
    create: async (userId, panNumber, idDocumentUrl, address) => {
        const query = `
      INSERT INTO KYC (user_id, pan_number, id_document_url, address)
      VALUES ($1, $2, $3, $4)
      RETURNING kyc_id, user_id, pan_number, id_document_url, address, status, created_at;
    `;
        const values = [userId, panNumber, idDocumentUrl, address];
        const result = await db.query(query, values);
        return result.rows[0];
    },

    // Find KYC record by user ID
    findByUserId: async (userId) => {
        const query = `SELECT * FROM KYC WHERE user_id = $1`;
        const result = await db.query(query, [userId]);
        return result.rows[0];
    },

    // Find KYC record by KYC ID
    findById: async (kycId) => {
        const query = `SELECT * FROM KYC WHERE kyc_id = $1`;
        const result = await db.query(query, [kycId]);
        return result.rows[0];
    },

    // Update the status of a KYC record (admin approve/reject)
    updateStatus: async (kycId, status, verifiedBy) => {
        const query = `
      UPDATE KYC
      SET status = $1, verified_by = $2
      WHERE kyc_id = $3
      RETURNING kyc_id, user_id, pan_number, status, verified_by;
    `;
        const values = [status, verifiedBy, kycId];
        const result = await db.query(query, values);
        return result.rows[0];
    },

    // Get all pending KYC records (for admin review)
    findAllPending: async () => {
        const query = `
      SELECT k.*, u.name, u.email
      FROM KYC k
      JOIN Users u ON k.user_id = u.user_id
      WHERE k.status = 'pending'
      ORDER BY k.created_at ASC;
    `;
        const result = await db.query(query);
        return result.rows;
    }
};

module.exports = KYC;
