const db = require('../config/db');

const Property = {
    // Create a new property listing
    create: async (ownerId, address, city, rentAmount, estimatedDeposit, buildingYear, inviteCode, furnishingLevel, propertyType) => {
        const query = `
      INSERT INTO Properties (owner_id, address, city, rent_amount, estimated_deposit, building_year, invite_code, furnishing_level, property_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
        const values = [ownerId, address, city, rentAmount, estimatedDeposit, buildingYear || null, inviteCode, furnishingLevel || 'unfurnished', propertyType || 'apartment'];
        const result = await db.query(query, values);
        return result.rows[0];
    },

    // Find all properties owned by a specific landlord
    findByOwnerId: async (ownerId) => {
        const query = `SELECT * FROM Properties WHERE owner_id = $1 ORDER BY created_at DESC`;
        const result = await db.query(query, [ownerId]);
        return result.rows;
    },

    // Find a property by its ID
    findById: async (propertyId) => {
        const query = `SELECT * FROM Properties WHERE property_id = $1`;
        const result = await db.query(query, [propertyId]);
        return result.rows[0];
    },

    // Find property by invite code (for tenants)
    findByInviteCode: async (inviteCode) => {
        const query = `
      SELECT p.*, u.name AS owner_name
      FROM Properties p
      JOIN Users u ON p.owner_id = u.user_id
      WHERE p.invite_code = $1;
    `;
        const result = await db.query(query, [inviteCode]);
        return result.rows[0];
    },

    // Update a property (including furnishing and type)
    update: async (propertyId, address, city, rentAmount, estimatedDeposit, buildingYear, furnishingLevel, propertyType) => {
        const query = `
      UPDATE Properties
      SET address = $1, city = $2, rent_amount = $3, estimated_deposit = $4, building_year = $5,
          furnishing_level = $6, property_type = $7
      WHERE property_id = $8
      RETURNING *;
    `;
        const values = [address, city, rentAmount, estimatedDeposit, buildingYear || null, furnishingLevel || 'unfurnished', propertyType || 'apartment', propertyId];
        const result = await db.query(query, values);
        return result.rows[0];
    },

    // Regenerate invite code
    regenerateInviteCode: async (propertyId) => {
        const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const query = `UPDATE Properties SET invite_code = $1 WHERE property_id = $2 RETURNING *;`;
        const result = await db.query(query, [newCode, propertyId]);
        return result.rows[0];
    },

    // Delete a property
    deleteProperty: async (propertyId) => {
        const query = `DELETE FROM Properties WHERE property_id = $1 RETURNING property_id`;
        const result = await db.query(query, [propertyId]);
        return result.rows[0];
    }
};

module.exports = Property;
