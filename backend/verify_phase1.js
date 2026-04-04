require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function verify() {
  const tables = ['coverages', 'insured_assets', 'audit_logs'];
  for (const t of tables) {
    const r = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_name='${t}' AND table_schema='public'`);
    console.log(r.rows.length > 0 ? '  FOUND: ' + t : '  MISSING: ' + t);
  }

  const cols = [
    ['policies', 'version_num'],
    ['policies', 'previous_policy_id'],
    ['risk_assessments', 'reasoning'],
    ['risk_assessments', 'probability_of_default'],
    ['properties', 'furnishing_level'],
    ['properties', 'property_type'],
    ['claims', 'calculated_payout'],
    ['claims', 'adjudication_reasoning'],
    ['claims', 'fraud_score'],
    ['claims', 'depreciation_applied'],
  ];

  for (const [tbl, col] of cols) {
    const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='${tbl}' AND column_name='${col}'`);
    console.log(r.rows.length > 0 ? '  FOUND: ' + tbl + '.' + col : '  MISSING: ' + tbl + '.' + col);
  }

  pool.end();
}

verify().catch(e => { console.error('Error:', e.message); pool.end(); });
