const mysql = require('mysql2/promise');

function env(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === null || v === '') return fallback;
  return v;
}

const pool = mysql.createPool({
  host: env('DB_HOST', 'localhost'),
  user: env('DB_USER', 'root'),
  password: env('DB_PASSWORD', ''),
  database: env('DB_NAME', 'courseregistration'),
  port: Number(env('DB_PORT', 3306)),
  connectionLimit: 10,
  decimalNumbers: true,
});

module.exports = { pool };

