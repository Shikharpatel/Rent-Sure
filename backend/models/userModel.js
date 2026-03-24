const db = require('../config/db');

const User = {
    // Create a new user
    create: async (name, email, passwordHash, role) => {
        const query = `
      INSERT INTO Users (name, email, password, role)
      VALUES ($1, $2, $3, $4)
      RETURNING user_id, name, email, role, created_at;
    `;
        const values = [name, email, passwordHash, role];
        const result = await db.query(query, values);
        return result.rows[0];
    },

    // Find user by email
    findByEmail: async (email) => {
        const query = `SELECT * FROM Users WHERE email = $1`;
        const result = await db.query(query, [email]);
        return result.rows[0];
    },

    // Find user by ID
    findById: async (id) => {
        const query = `
      SELECT user_id, name, email, role, created_at
      FROM Users
      WHERE user_id = $1
    `;
        const result = await db.query(query, [id]);
        return result.rows[0];
    }
};

module.exports = User;
