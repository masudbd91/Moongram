const { Pool } = require('pg');

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/proximity_db',
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

async function healthCheck() {
  try {
    const result = await pool.query('SELECT NOW()');
    return { ok: true, time: result.rows[0].now };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  healthCheck,
};
