// Migration script: Add invite_code to Properties
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log('Running migration: Adding invite_code to Properties...');
    await pool.query(`
      ALTER TABLE Properties 
      ADD COLUMN IF NOT EXISTS invite_code VARCHAR(10) UNIQUE;
    `);
    console.log('✅ Added invite_code column');

    // Populate existing properties with random invite codes
    const res = await pool.query('SELECT property_id FROM Properties WHERE invite_code IS NULL');
    console.log(`Found ${res.rowCount} properties needing invite codes.`);
    
    for (let row of res.rows) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      await pool.query('UPDATE Properties SET invite_code = $1 WHERE property_id = $2', [code, row.property_id]);
    }
    
    console.log('✅ Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    pool.end();
  }
}

migrate();
