const { Pool } = require('pg');

function env(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === null || v === '') return fallback;
  return v;
}

// Optional: if DATABASE_URL is provided, pg Pool can use it directly.
// We still support discrete env vars to match the previous README.
const databaseUrl = process.env.DATABASE_URL;

const pool = new Pool(
  databaseUrl
    ? {
        connectionString: databaseUrl,
      }
    : {
        host: env('DB_HOST', 'localhost'),
        user: env('DB_USER', 'root'),
        password: env('DB_PASSWORD', ''),
        database: env('DB_NAME', 'courseregistration'),
        port: Number(env('DB_PORT', 5432)),
        max: 10,
        idleTimeoutMillis: 30000,
      }
);

module.exports = { pool };

