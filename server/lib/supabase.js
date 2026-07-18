const { createClient } = require('@supabase/supabase-js');

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('Missing SUPABASE_URL');
  if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

  // Service role is used so the backend can operate regardless of RLS policies.
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

module.exports = {
  getSupabaseClient,
};

