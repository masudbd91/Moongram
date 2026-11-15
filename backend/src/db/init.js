const fs = require('fs');
const path = require('path');
const { query, pool } = require('./pg');

async function initializeDatabase() {
  try {
    await query('SELECT 1');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    await pool.query(schemaSql);
    console.log('✅ PostgreSQL schema initialized');
    return true;
  } catch (error) {
    console.warn('PostgreSQL not ready yet, continuing in fallback mode:', error.message);
    return false;
  }
}

module.exports = { initializeDatabase };
