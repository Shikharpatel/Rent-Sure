const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

// Use WebSockets so connections go over port 443 (avoids ISP blocks on 5432)
neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('connect', () => {
  console.log('Successfully connected to the PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
