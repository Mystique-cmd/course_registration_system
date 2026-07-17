const { Pool } = require('pg');

function env(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === null || v === '') return fallback;
  return v;
}

function truthyEnv(name) {
  const v = process.env[name];
  if (v === undefined || v === null) return false;
  return String(v).toLowerCase() === 'true' || String(v) === '1' || String(v).toLowerCase() === 'yes';
}


// Optional: if DATABASE_URL is provided, pg Pool can use it directly.
// We also support Supabase-provided connection env var aliases.
function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
}

// Common Supabase env vars (you may have one or more depending on how you configured Vercel)
const supabaseConnectionString = firstNonEmpty(
  process.env.SUPABASE_DB_CONNECTION_STRING,
  process.env.SUPABASE_CONNECTION_STRING,
  process.env.SUPABASE_DB_URL,
  process.env.SUPABASE_URL // NOTE: this is NOT a Postgres connection string; only used as fallback guard
);

const databaseUrl = firstNonEmpty(process.env.DATABASE_URL, supabaseConnectionString);

let pool;

if (databaseUrl) {
  // IMPORTANT: if you set SUPABASE_URL by mistake (it looks like https://xxxx.supabase.co)
  // then pg will fail. Prefer the Supabase dashboard "Connection string".
  if (String(databaseUrl).startsWith('http')) {
    console.error(
      '[db] DATABASE_URL appears to be an HTTP URL. For Supabase Postgres, set DATABASE_URL (or SUPABASE_DB_CONNECTION_STRING) to the *Postgres* connection string from Supabase dashboard.'
    );
  }

  pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    ssl:
      truthyEnv('DB_SSL') ||
      String(process.env.PGSSLMODE || '').toLowerCase() === 'require' ||
      process.env.NODE_ENV === 'production',
  });

} else {
  // Only require discrete connection settings when DATABASE_URL is not present.
  // This avoids crashing on Vercel when you rely solely on DATABASE_URL.
  const host = env('DB_HOST', 'localhost');
  const user = env('DB_USER', 'root');
  const password = env('DB_PASSWORD', '');
  const database = env('DB_NAME', 'courseregistration');
  const port = Number(env('DB_PORT', 5432));

  if (!user || !host || !database || !password) {
    console.error(
      '[db] Missing database connection configuration. Set DATABASE_URL (recommended for Supabase) OR set DB_HOST/DB_USER/DB_PASSWORD/DB_NAME/DB_PORT.'
    );
  }

  pool = new Pool({
    host,
    user,
    password,
    database,
    port,
    max: 10,
    idleTimeoutMillis: 30000,
    ssl:
      truthyEnv('DB_SSL') ||
      String(process.env.PGSSLMODE || '').toLowerCase() === 'require' ||
      process.env.NODE_ENV === 'production',
  });

}

module.exports = { pool };


