const { Pool } = require('pg');

// Initialize the PostgreSQL connection pool using environment variables
// Supports Neon/Cloud standard DATABASE_URL format
const pool = new Pool(
  process.env.DATABASE_URL 
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Required for Neon
      }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 5432,
      }
);

// Test the database connection
pool.on('connect', () => {
  console.log('Successfully connected to the PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  // Expose a query function to execute queries directly
  query: (text, params) => pool.query(text, params),
  // Expose the pool directly if needed for transactions
  pool,
};
